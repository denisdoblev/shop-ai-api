import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Product } from '../../../products/entities/product.entity';
import { ChunkingService } from '../chunking/chunking.service';
import { EMBEDDING_DIMENSIONS } from '../embeddings/embedding.constants';
import { EmbeddingProviderError } from '../embeddings/embedding-provider.error';
import { EmbeddingVector } from '../embeddings/embedding-provider.interface';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { RagChunk } from '../entities/rag-chunk.entity';
import { RagDocumentSourceType } from '../entities/rag-document-source-type.enum';
import { RagDocumentStatus } from '../entities/rag-document-status.enum';
import { RagDocument } from '../entities/rag-document.entity';
import { PdfParserService } from '../pdf/pdf-parser.service';
import { CreateRagDocumentDto, RagDocumentResponseDto } from './dto';

interface PostgresError {
  code?: string;
  constraint?: string;
}

const ACTIVE_DOCUMENT_HASH_CONSTRAINT =
  'uq_rag_documents_product_content_hash_active';

@Injectable()
export class IngestionService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(RagDocument)
    private readonly documentRepository: Repository<RagDocument>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly pdfParserService: PdfParserService,
    private readonly chunkingService: ChunkingService,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  async ingestPdf(
    productId: string,
    file: Express.Multer.File,
    options: CreateRagDocumentDto,
  ): Promise<RagDocumentResponseDto> {
    await this.validateProduct(productId);
    this.validateFile(file);
    this.validateChunkOptions(options);

    const contentHash = createHash('sha256').update(file.buffer).digest('hex');
    const duplicate = await this.documentRepository.findOneBy({
      productId,
      contentHash,
    });
    if (duplicate) {
      throw new ConflictException(
        'An active RAG document with the same content already exists',
      );
    }

    const pages = await this.pdfParserService.parse(
      new Uint8Array(file.buffer),
    );
    let chunks;
    try {
      chunks = this.chunkingService.chunk(pages, options);
    } catch (error: unknown) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    let embeddings: EmbeddingVector[];
    try {
      embeddings = await this.embeddingsService.embedDocuments(
        chunks.map(({ content }) => ({ content, title: file.originalname })),
      );
      this.validateEmbeddings(embeddings, chunks.length);
    } catch (error: unknown) {
      if (error instanceof EmbeddingProviderError) {
        throw new ServiceUnavailableException(
          'Embedding provider is unavailable',
        );
      }
      throw error;
    }

    const processedAt = new Date();

    try {
      return await this.dataSource.transaction(async (manager) => {
        const documentRepository = manager.getRepository(RagDocument);
        const chunkRepository = manager.getRepository(RagChunk);
        const document = await documentRepository.save(
          documentRepository.create({
            productId,
            name: file.originalname,
            sourceType: RagDocumentSourceType.PDF,
            sourceUri: null,
            mimeType: 'application/pdf',
            contentHash,
            status: RagDocumentStatus.READY,
            processingError: null,
            processedAt,
            pageCount: pages.length,
            fileSizeBytes: file.size.toString(),
            metadata: {
              chunkSize: options.chunkSize,
              chunkOverlap: options.chunkOverlap,
            },
          }),
        );

        await chunkRepository.save(
          chunks.map(({ content, pageNumber }, chunkIndex) => {
            const embedding = embeddings[chunkIndex];
            if (!embedding) {
              throw new Error('Missing validated embedding');
            }

            return chunkRepository.create({
              documentId: document.id,
              content,
              chunkIndex,
              pageStart: pageNumber,
              pageEnd: pageNumber,
              section: null,
              tokenCount: null,
              metadata: { pageNumber },
              embedding: embedding.values,
              embeddingModel: embedding.model,
              embeddedAt: processedAt,
            });
          }),
        );

        return this.toResponse(document, chunks.length);
      });
    } catch (error: unknown) {
      if (this.isDuplicateHashError(error)) {
        throw new ConflictException(
          'An active RAG document with the same content already exists',
        );
      }
      throw error;
    }
  }

  private async validateProduct(productId: string): Promise<void> {
    if (!(await this.productRepository.findOneBy({ id: productId }))) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }
  }

  private validateFile(file: Express.Multer.File): void {
    const maximumSize = this.configService.get<number>(
      'RAG_PDF_MAX_FILE_SIZE_BYTES',
      26_214_400,
    );
    if (file.size <= 0 || file.buffer.length === 0) {
      throw new BadRequestException('PDF file must not be empty');
    }
    if (file.size > maximumSize || file.buffer.length > maximumSize) {
      throw new BadRequestException(
        `PDF exceeds the maximum size of ${maximumSize} bytes`,
      );
    }
    if (
      file.mimetype.toLowerCase() !== 'application/pdf' ||
      file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-'
    ) {
      throw new BadRequestException('Only PDF files are accepted');
    }
    if (file.originalname.length === 0 || file.originalname.length > 255) {
      throw new BadRequestException(
        'PDF filename must contain between 1 and 255 characters',
      );
    }
  }

  private validateChunkOptions(options: CreateRagDocumentDto): void {
    if (
      !Number.isInteger(options.chunkSize) ||
      options.chunkSize < 200 ||
      options.chunkSize > 4_000 ||
      !Number.isInteger(options.chunkOverlap) ||
      options.chunkOverlap < 0 ||
      options.chunkOverlap >= options.chunkSize
    ) {
      throw new BadRequestException('Invalid chunk configuration');
    }
  }

  private validateEmbeddings(
    embeddings: EmbeddingVector[],
    expectedCount: number,
  ): void {
    const model = embeddings[0]?.model;
    const valid =
      embeddings.length === expectedCount &&
      typeof model === 'string' &&
      model.trim().length > 0 &&
      embeddings.every(
        (embedding) =>
          embedding.model === model &&
          embedding.dimensions === EMBEDDING_DIMENSIONS &&
          embedding.values.length === EMBEDDING_DIMENSIONS &&
          embedding.values.every(Number.isFinite),
      );

    if (!valid) {
      throw new ServiceUnavailableException(
        'Embedding provider returned incompatible vectors',
      );
    }
  }

  private isDuplicateHashError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as PostgresError;
    return (
      driverError.code === '23505' &&
      driverError.constraint === ACTIVE_DOCUMENT_HASH_CONSTRAINT
    );
  }

  private toResponse(
    document: RagDocument,
    chunkCount: number,
  ): RagDocumentResponseDto {
    if (
      document.pageCount === null ||
      document.fileSizeBytes === null ||
      document.processedAt === null
    ) {
      throw new Error('Ready PDF document is missing processing metadata');
    }

    return {
      id: document.id,
      productId: document.productId,
      name: document.name,
      sourceType: document.sourceType,
      mimeType: document.mimeType,
      status: document.status,
      pageCount: document.pageCount,
      chunkCount,
      fileSizeBytes: document.fileSizeBytes,
      processedAt: document.processedAt,
      createdAt: document.createdAt,
    };
  }
}
