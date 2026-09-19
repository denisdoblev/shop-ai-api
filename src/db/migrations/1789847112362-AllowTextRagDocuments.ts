import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowTextRagDocuments1789847112362 implements MigrationInterface {
  name = 'AllowTextRagDocuments1789847112362';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rag_documents" DROP CONSTRAINT "chk_rag_documents_source_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rag_documents" ADD CONSTRAINT "chk_rag_documents_source_type" CHECK (source_type IN ('pdf', 'text'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "rag_documents" ALTER COLUMN "source_uri" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "rag_documents" WHERE "source_type" = 'text'
        ) THEN
          RAISE EXCEPTION 'Cannot rollback text RAG documents while text rows exist';
        END IF;

        IF EXISTS (
          SELECT 1 FROM "rag_documents" WHERE "source_uri" IS NULL
        ) THEN
          RAISE EXCEPTION 'Cannot rollback nullable RAG document source URIs while null rows exist';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "rag_documents" DROP CONSTRAINT "chk_rag_documents_source_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rag_documents" ADD CONSTRAINT "chk_rag_documents_source_type" CHECK (source_type IN ('pdf'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "rag_documents" ALTER COLUMN "source_uri" SET NOT NULL`,
    );
  }
}
