import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { Product } from '../../../products/entities/product.entity';
import { ChunkingService } from '../chunking/chunking.service';
import { EMBEDDING_DIMENSIONS } from '../embeddings/embedding.constants';
import { EmbeddingProviderError } from '../embeddings/embedding-provider.error';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { RagChunk } from '../entities/rag-chunk.entity';
import { RagDocumentSourceType } from '../entities/rag-document-source-type.enum';
import { RagDocumentStatus } from '../entities/rag-document-status.enum';
import { RagDocument } from '../entities/rag-document.entity';
import { PdfParserService } from '../pdf/pdf-parser.service';
import { IngestionService } from './ingestion.service';

describe('IngestionService', () => {
  const productId = 'f7a9589d-30e2-4edc-9d28-dafd6b769023';
  const now = new Date('2026-09-19T00:00:00.000Z');
  const file = {
    fieldname: 'file',
    originalname: 'manual.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 12,
    buffer: Buffer.from('%PDF-manual'),
  } as Express.Multer.File;
  const options = { chunkSize: 1200, chunkOverlap: 200 };
  const productRepository = {
    findOneBy: jest.fn<Promise<Product | null>, [{ id: string }]>(),
  };
  const documentRepository = {
    findOneBy: jest.fn<
      Promise<RagDocument | null>,
      [{ productId: string; contentHash: string }]
    >(),
  };
  const txDocumentRepository = {
    create: jest.fn<RagDocument, [Partial<RagDocument>]>(),
    save: jest.fn<Promise<RagDocument>, [RagDocument]>(),
  };
  const txChunkRepository = {
    create: jest.fn<RagChunk, [Partial<RagChunk>]>(),
    save: jest.fn<Promise<RagChunk[]>, [RagChunk[]]>(),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === RagDocument ? txDocumentRepository : txChunkRepository,
    ),
  };
  const dataSource = {
    transaction: jest.fn(
      async (callback: (entityManager: EntityManager) => Promise<unknown>) =>
        callback(manager as unknown as EntityManager),
    ),
  };
  const configService = { get: jest.fn().mockReturnValue(26_214_400) };
  const pdfParserService = { parse: jest.fn() };
  const chunkingService = { chunk: jest.fn() };
  const embeddingsService = { embedDocuments: jest.fn() };
  const service = new IngestionService(
    productRepository as unknown as Repository<Product>,
    documentRepository as unknown as Repository<RagDocument>,
    dataSource as unknown as DataSource,
    configService as unknown as ConfigService,
    pdfParserService as unknown as PdfParserService,
    chunkingService as unknown as ChunkingService,
    embeddingsService as unknown as EmbeddingsService,
  );

  const embedding = (value = 0.25) => ({
    values: Array.from({ length: EMBEDDING_DIMENSIONS }, () => value),
    model: 'embeddinggemma',
    dimensions: EMBEDDING_DIMENSIONS,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    productRepository.findOneBy.mockResolvedValue({ id: productId } as Product);
    documentRepository.findOneBy.mockResolvedValue(null);
    pdfParserService.parse.mockResolvedValue([
      { pageNumber: 1, text: 'First page' },
      { pageNumber: 2, text: 'Physical microphone mute button' },
    ]);
    chunkingService.chunk.mockReturnValue([
      { pageNumber: 1, content: 'First page' },
      { pageNumber: 2, content: 'Physical microphone mute button' },
    ]);
    embeddingsService.embedDocuments.mockResolvedValue([
      embedding(0.1),
      embedding(0.2),
    ]);
    txDocumentRepository.create.mockImplementation(
      (value) => value as RagDocument,
    );
    txDocumentRepository.save.mockImplementation((value) =>
      Promise.resolve({
        ...value,
        id: 'document-id',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }),
    );
    txChunkRepository.create.mockImplementation((value) => value as RagChunk);
    txChunkRepository.save.mockResolvedValue([]);
  });

  it('validates, prepares collaborators, and persists a ready document atomically', async () => {
    const result = await service.ingestPdf(productId, file, options);

    expect(productRepository.findOneBy).toHaveBeenCalledWith({ id: productId });
    const duplicateLookup = documentRepository.findOneBy.mock.calls[0]?.[0];
    expect(duplicateLookup).toEqual({
      productId,
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u) as string,
    });
    expect(pdfParserService.parse).toHaveBeenCalledWith(
      new Uint8Array(file.buffer),
    );
    expect(chunkingService.chunk).toHaveBeenCalledWith(
      [
        { pageNumber: 1, text: 'First page' },
        { pageNumber: 2, text: 'Physical microphone mute button' },
      ],
      options,
    );
    expect(embeddingsService.embedDocuments).toHaveBeenCalledWith([
      { content: 'First page', title: 'manual.pdf' },
      { content: 'Physical microphone mute button', title: 'manual.pdf' },
    ]);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(txDocumentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        productId,
        name: 'manual.pdf',
        sourceType: RagDocumentSourceType.PDF,
        sourceUri: null,
        mimeType: 'application/pdf',
        status: RagDocumentStatus.READY,
        pageCount: 2,
        fileSizeBytes: '12',
        processingError: null,
      }),
    );
    expect(txChunkRepository.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        documentId: 'document-id',
        content: 'Physical microphone mute button',
        chunkIndex: 1,
        pageStart: 2,
        pageEnd: 2,
        metadata: { pageNumber: 2 },
        embeddingModel: 'embeddinggemma',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'document-id',
        productId,
        status: RagDocumentStatus.READY,
        pageCount: 2,
        chunkCount: 2,
        fileSizeBytes: '12',
        createdAt: now,
      }),
    );

    const parseOrder = pdfParserService.parse.mock.invocationCallOrder[0];
    const chunkOrder = chunkingService.chunk.mock.invocationCallOrder[0];
    const embedOrder =
      embeddingsService.embedDocuments.mock.invocationCallOrder[0];
    const transactionOrder = dataSource.transaction.mock.invocationCallOrder[0];
    expect(parseOrder).toBeLessThan(chunkOrder ?? 0);
    expect(chunkOrder).toBeLessThan(embedOrder ?? 0);
    expect(embedOrder).toBeLessThan(transactionOrder ?? 0);
  });

  it('rejects a missing product before parsing', async () => {
    productRepository.findOneBy.mockResolvedValue(null);

    await expect(
      service.ingestPdf(productId, file, options),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(pdfParserService.parse).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects a known duplicate before parsing', async () => {
    documentRepository.findOneBy.mockResolvedValue({
      id: 'duplicate',
    } as RagDocument);

    await expect(
      service.ingestPdf(productId, file, options),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(pdfParserService.parse).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('normalizes embedding provider failures and does not write', async () => {
    embeddingsService.embedDocuments.mockRejectedValue(
      new EmbeddingProviderError('unavailable', 'offline'),
    );

    await expect(
      service.ingestPdf(productId, file, options),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects incompatible embeddings before opening a transaction', async () => {
    embeddingsService.embedDocuments.mockResolvedValue([embedding()]);

    await expect(service.ingestPdf(productId, file, options)).rejects.toThrow(
      'Embedding provider returned incompatible vectors',
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('propagates transactional chunk writes so TypeORM can roll back the document', async () => {
    txChunkRepository.save.mockRejectedValue(new Error('chunk write failed'));

    await expect(service.ingestPdf(productId, file, options)).rejects.toThrow(
      'chunk write failed',
    );
    expect(txDocumentRepository.save).toHaveBeenCalledTimes(1);
    expect(txChunkRepository.save).toHaveBeenCalledTimes(1);
  });

  it('maps the concurrent active-hash constraint to conflict', async () => {
    dataSource.transaction.mockRejectedValueOnce(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_rag_documents_product_content_hash_active',
        }),
      ),
    );

    await expect(
      service.ingestPdf(productId, file, options),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
