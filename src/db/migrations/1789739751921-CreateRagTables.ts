import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRagTables1789739751921 implements MigrationInterface {
  name = 'CreateRagTables1789739751921';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "rag_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "product_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "source_type" character varying(20) NOT NULL DEFAULT 'pdf', "source_uri" text NOT NULL, "mime_type" character varying(100) NOT NULL DEFAULT 'application/pdf', "content_hash" character(64) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "processing_error" text, "processed_at" TIMESTAMP WITH TIME ZONE, "page_count" integer, "file_size_bytes" bigint, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "chk_rag_documents_source_type" CHECK (source_type IN ('pdf')), CONSTRAINT "chk_rag_documents_content_hash" CHECK (content_hash ~ '^[0-9A-Fa-f]{64}$'), CONSTRAINT "chk_rag_documents_status" CHECK (status IN ('pending', 'processing', 'ready', 'failed')), CONSTRAINT "chk_rag_documents_page_count" CHECK (page_count IS NULL OR page_count > 0), CONSTRAINT "chk_rag_documents_file_size_bytes" CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0), CONSTRAINT "chk_rag_documents_metadata_object" CHECK (jsonb_typeof(metadata) = 'object'), CONSTRAINT "PK_rag_documents" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "rag_chunks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "document_id" uuid NOT NULL, "content" text NOT NULL, "chunk_index" integer NOT NULL, "page_start" integer, "page_end" integer, "section" text, "token_count" integer, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "embedding" vector, "embedding_model" character varying(150), "embedded_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_rag_chunks_content_not_empty" CHECK (btrim(content) <> ''), CONSTRAINT "chk_rag_chunks_chunk_index" CHECK (chunk_index >= 0), CONSTRAINT "chk_rag_chunks_page_start" CHECK (page_start IS NULL OR page_start > 0), CONSTRAINT "chk_rag_chunks_page_end" CHECK (page_end IS NULL OR page_end > 0), CONSTRAINT "chk_rag_chunks_page_range" CHECK (page_start IS NULL OR page_end IS NULL OR page_end >= page_start), CONSTRAINT "chk_rag_chunks_token_count" CHECK (token_count IS NULL OR token_count >= 0), CONSTRAINT "chk_rag_chunks_metadata_object" CHECK (jsonb_typeof(metadata) = 'object'), CONSTRAINT "chk_rag_chunks_embedding_state" CHECK ((embedding IS NULL AND embedding_model IS NULL AND embedded_at IS NULL) OR (embedding IS NOT NULL AND embedding_model IS NOT NULL AND btrim(embedding_model) <> '' AND embedded_at IS NOT NULL)), CONSTRAINT "PK_rag_chunks" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_rag_documents_product_active" ON "rag_documents" ("product_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_rag_documents_product_content_hash_active" ON "rag_documents" ("product_id", "content_hash") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_rag_chunks_document_active" ON "rag_chunks" ("document_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_rag_chunks_document_chunk_index_active" ON "rag_chunks" ("document_id", "chunk_index") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "rag_documents" ADD CONSTRAINT "fk_rag_documents_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "rag_chunks" ADD CONSTRAINT "fk_rag_chunks_document" FOREIGN KEY ("document_id") REFERENCES "rag_documents"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rag_chunks" DROP CONSTRAINT "fk_rag_chunks_document"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_rag_chunks_document_chunk_index_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_rag_chunks_document_active"`,
    );
    await queryRunner.query(`DROP TABLE "rag_chunks"`);
    await queryRunner.query(
      `ALTER TABLE "rag_documents" DROP CONSTRAINT "fk_rag_documents_product"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_rag_documents_product_content_hash_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_rag_documents_product_active"`,
    );
    await queryRunner.query(`DROP TABLE "rag_documents"`);
  }
}
