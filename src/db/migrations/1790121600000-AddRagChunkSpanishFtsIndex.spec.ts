import { QueryRunner } from 'typeorm';
import { AddRagChunkSpanishFtsIndex1790121600000 } from './1790121600000-AddRagChunkSpanishFtsIndex';

describe('AddRagChunkSpanishFtsIndex1790121600000', () => {
  const query = jest.fn<Promise<void>, [string]>();
  const queryRunner = { query } as unknown as QueryRunner;
  const migration = new AddRagChunkSpanishFtsIndex1790121600000();

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue();
  });

  it('creates a partial Spanish GIN index for active chunks', async () => {
    await migration.up(queryRunner);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        `USING gin (to_tsvector('spanish', coalesce("section", '') || ' ' || "content"))`,
      ),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE "deleted_at" IS NULL'),
    );
  });

  it('rolls back only the lexical index', async () => {
    await migration.down(queryRunner);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'DROP INDEX "public"."idx_rag_chunks_spanish_fts_active"',
      ),
    );
  });
});
