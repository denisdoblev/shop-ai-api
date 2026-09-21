import { Repository } from 'typeorm';
import { EMBEDDING_DIMENSIONS } from '../embeddings/embedding.constants';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { RagChunk } from '../entities/rag-chunk.entity';
import { RetrievalService } from './retrieval.service';

describe('RetrievalService', () => {
  const values = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.25);
  const embeddingsService = {
    embedQuery: jest.fn(),
  };
  const chunkRepository = {
    query: jest.fn(),
  };
  const service = new RetrievalService(
    embeddingsService as unknown as EmbeddingsService,
    chunkRepository as unknown as Repository<RagChunk>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    embeddingsService.embedQuery.mockResolvedValue({
      values,
      model: 'embeddinggemma',
      dimensions: EMBEDDING_DIMENSIONS,
    });
    chunkRepository.query.mockResolvedValue([]);
  });

  it('embeds once and performs a parameterized cosine search with stable ordering', async () => {
    await expect(
      service.retrieve('physical mute button', { topK: 3 }),
    ).resolves.toEqual([]);

    expect(embeddingsService.embedQuery).toHaveBeenCalledTimes(1);
    expect(embeddingsService.embedQuery).toHaveBeenCalledWith(
      'physical mute button',
    );
    const [sql, parameters] = chunkRepository.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain('chunk.embedding <=> $1::vector');
    expect(sql).toContain('1 - (chunk.embedding <=> $1::vector)');
    expect(sql).toContain('chunk.deleted_at IS NULL');
    expect(sql).toContain('document.deleted_at IS NULL');
    expect(sql).toContain('product.deleted_at IS NULL');
    expect(sql).toContain("document.status = 'ready'");
    expect(sql).toContain('chunk.embedding IS NOT NULL');
    expect(sql).toContain('chunk.embedding_model = $2');
    expect(sql).toContain('document.name AS "documentName"');
    expect(sql).toContain('chunk.page_start AS "pageStart"');
    expect(sql).toContain('chunk.page_end AS "pageEnd"');
    expect(sql).toContain('chunk.section AS "section"');
    expect(sql).toContain(
      'ORDER BY chunk.embedding <=> $1::vector ASC, chunk.id ASC',
    );
    expect(sql).toContain('LIMIT $3');
    expect(sql).not.toContain('document.product_id = $4');
    expect(parameters).toEqual([`[${values.join(',')}]`, 'embeddinggemma', 3]);
  });

  it('adds the optional product filter as a parameter', async () => {
    const productId = 'f7a9589d-30e2-4edc-9d28-dafd6b769023';

    await service.retrieve('mute button', { topK: 2, productId });

    const [sql, parameters] = chunkRepository.query.mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toContain('AND document.product_id = $4');
    expect(parameters).toEqual([
      `[${values.join(',')}]`,
      'embeddinggemma',
      2,
      productId,
    ]);
  });

  it('maps database similarity values without exposing embeddings', async () => {
    chunkRepository.query.mockResolvedValue([
      {
        id: 'chunk-id',
        documentId: 'document-id',
        documentName: 'Manual',
        productId: 'product-id',
        content: 'Mute button',
        chunkIndex: 0,
        pageStart: 14,
        pageEnd: 14,
        section: null,
        metadata: { source: 'manual' },
        similarity: '0.875',
      },
    ]);

    await expect(service.retrieve('mute', { topK: 1 })).resolves.toEqual([
      {
        id: 'chunk-id',
        documentId: 'document-id',
        documentName: 'Manual',
        productId: 'product-id',
        content: 'Mute button',
        chunkIndex: 0,
        pageStart: 14,
        pageEnd: 14,
        section: null,
        metadata: { source: 'manual' },
        similarity: 0.875,
      },
    ]);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'rejects invalid topK %s before embedding or querying',
    async (topK) => {
      await expect(service.retrieve('mute', { topK })).rejects.toThrow(
        'topK must be a positive integer',
      );
      expect(embeddingsService.embedQuery).not.toHaveBeenCalled();
      expect(chunkRepository.query).not.toHaveBeenCalled();
    },
  );

  it('rejects an incompatible query vector before querying PostgreSQL', async () => {
    embeddingsService.embedQuery.mockResolvedValue({
      values: [0.1, 0.2],
      model: 'wrong-model',
      dimensions: 2,
    });

    await expect(service.retrieve('mute', { topK: 1 })).rejects.toThrow(
      `Query embedding must have ${EMBEDDING_DIMENSIONS} dimensions`,
    );
    expect(chunkRepository.query).not.toHaveBeenCalled();
  });
});
