import { QueryRunner } from 'typeorm';
import { EMBEDDING_DIMENSIONS } from '../../ai/rag/embeddings/embedding.constants';
import { DimensionRagChunkEmbeddings1789847117759 } from './1789847117759-DimensionRagChunkEmbeddings';

describe('DimensionRagChunkEmbeddings1789847117759', () => {
  const query = jest.fn<Promise<void>, [string]>();
  const queryRunner = { query } as unknown as QueryRunner;
  const migration = new DimensionRagChunkEmbeddings1789847117759();

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue();
  });

  it('validates existing vectors before constraining and indexing them', async () => {
    await migration.up(queryRunner);

    const statements = query.mock.calls.map(([statement]) => statement);
    expect(statements[0]).toContain(
      `vector_dims("embedding") <> ${EMBEDDING_DIMENSIONS}`,
    );
    expect(statements[0]).toContain('RAISE EXCEPTION');
    expect(statements[1]).toContain(
      `TYPE vector(${EMBEDDING_DIMENSIONS}) USING "embedding"::vector(${EMBEDDING_DIMENSIONS})`,
    );
    expect(statements[2]).toContain(
      'USING hnsw ("embedding" vector_cosine_ops)',
    );
    expect(statements[2]).toContain(
      'WHERE "deleted_at" IS NULL AND "embedding" IS NOT NULL',
    );
  });

  it('drops the index before returning to an unconstrained vector', async () => {
    await migration.down(queryRunner);

    const statements = query.mock.calls.map(([statement]) => statement);
    expect(statements).toEqual([
      expect.stringContaining(
        'DROP INDEX "public"."idx_rag_chunks_embedding_hnsw_active"',
      ),
      expect.stringContaining(
        'ALTER COLUMN "embedding" TYPE vector USING "embedding"::vector',
      ),
    ]);
  });
});
