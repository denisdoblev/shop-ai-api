import { MigrationInterface, QueryRunner } from 'typeorm';

export class DimensionRagChunkEmbeddings1789847117759 implements MigrationInterface {
  name = 'DimensionRagChunkEmbeddings1789847117759';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "rag_chunks"
          WHERE "embedding" IS NOT NULL
            AND vector_dims("embedding") <> 768
        ) THEN
          RAISE EXCEPTION 'Cannot constrain RAG chunk embeddings: existing vectors must have 768 dimensions';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "rag_chunks" ALTER COLUMN "embedding" TYPE vector(768) USING "embedding"::vector(768)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_rag_chunks_embedding_hnsw_active" ON "rag_chunks" USING hnsw ("embedding" vector_cosine_ops) WHERE "deleted_at" IS NULL AND "embedding" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_rag_chunks_embedding_hnsw_active"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rag_chunks" ALTER COLUMN "embedding" TYPE vector USING "embedding"::vector`,
    );
  }
}
