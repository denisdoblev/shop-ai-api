import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRagChunkSpanishFtsIndex1790121600000 implements MigrationInterface {
  name = 'AddRagChunkSpanishFtsIndex1790121600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_rag_chunks_spanish_fts_active" ON "rag_chunks" USING gin (to_tsvector('spanish', coalesce("section", '') || ' ' || "content")) WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_rag_chunks_spanish_fts_active"`,
    );
  }
}
