import { QueryRunner } from 'typeorm';
import { CreateRagTables1789739751921 } from './1789739751921-CreateRagTables';

describe('CreateRagTables1789739751921', () => {
  const query = jest.fn<Promise<void>, [string]>();
  const queryRunner = { query } as unknown as QueryRunner;
  const migration = new CreateRagTables1789739751921();

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue();
  });

  it('creates documents before chunks with the required columns and defaults', async () => {
    await migration.up(queryRunner);
    const statements = query.mock.calls.map(([statement]) => statement);

    expect(statements[0]).toContain('CREATE TABLE "rag_documents"');
    expect(statements[1]).toContain('CREATE TABLE "rag_chunks"');
    expect(statements[0]).toContain(
      '"id" uuid NOT NULL DEFAULT uuid_generate_v4()',
    );
    expect(statements[0]).toContain(
      '"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()',
    );
    expect(statements[0]).toContain(
      '"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()',
    );
    expect(statements[0]).toContain('"deleted_at" TIMESTAMP WITH TIME ZONE');
    expect(statements[0]).toContain('"product_id" uuid NOT NULL');
    expect(statements[0]).toContain('"name" character varying(255) NOT NULL');
    expect(statements[0]).toContain(
      '"source_type" character varying(20) NOT NULL DEFAULT \'pdf\'',
    );
    expect(statements[0]).toContain(
      '"mime_type" character varying(100) NOT NULL DEFAULT \'application/pdf\'',
    );
    expect(statements[0]).toContain('"source_uri" text NOT NULL');
    expect(statements[0]).toContain('"content_hash" character(64) NOT NULL');
    expect(statements[0]).toContain(
      '"status" character varying(20) NOT NULL DEFAULT \'pending\'',
    );
    expect(statements[0]).toContain(
      '"metadata" jsonb NOT NULL DEFAULT \'{}\'::jsonb',
    );
    expect(statements[0]).toContain('"processing_error" text');
    expect(statements[0]).toContain('"processed_at" TIMESTAMP WITH TIME ZONE');
    expect(statements[0]).toContain('"page_count" integer');
    expect(statements[0]).toContain('"file_size_bytes" bigint');
    expect(statements[1]).toContain(
      '"id" uuid NOT NULL DEFAULT uuid_generate_v4()',
    );
    expect(statements[1]).toContain(
      '"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()',
    );
    expect(statements[1]).toContain(
      '"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()',
    );
    expect(statements[1]).toContain('"deleted_at" TIMESTAMP WITH TIME ZONE');
    expect(statements[1]).toContain('"document_id" uuid NOT NULL');
    expect(statements[1]).toContain('"content" text NOT NULL');
    expect(statements[1]).toContain('"chunk_index" integer NOT NULL');
    expect(statements[1]).toContain('"page_start" integer');
    expect(statements[1]).toContain('"page_end" integer');
    expect(statements[1]).toContain('"section" text');
    expect(statements[1]).toContain('"token_count" integer');
    expect(statements[1]).toContain(
      '"metadata" jsonb NOT NULL DEFAULT \'{}\'::jsonb',
    );
    expect(statements[1]).toContain('"embedding" vector');
    expect(statements[1]).not.toMatch(/"embedding" vector\(\d+\)/);
    expect(statements[1]).toContain('"embedding_model" character varying(150)');
    expect(statements[1]).toContain('"embedded_at" TIMESTAMP WITH TIME ZONE');
  });

  it('creates checks, partial indexes, and restrictive foreign keys', async () => {
    await migration.up(queryRunner);
    const statements = query.mock.calls.map(([statement]) => statement);
    const sql = statements.join('\n');

    expect(sql).toContain('chk_rag_documents_content_hash');
    expect(sql).toContain('chk_rag_documents_source_type');
    expect(sql).toContain('chk_rag_documents_status');
    expect(sql).toContain('chk_rag_documents_metadata_object');
    expect(sql).toContain('chk_rag_chunks_content_not_empty');
    expect(sql).toContain('chk_rag_chunks_chunk_index');
    expect(sql).toContain('chk_rag_chunks_page_range');
    expect(sql).toContain('chk_rag_chunks_metadata_object');
    expect(sql).toContain('chk_rag_chunks_embedding_state');
    expect(sql).toContain('idx_rag_documents_product_active');
    expect(sql).toContain('uq_rag_documents_product_content_hash_active');
    expect(sql).toContain('idx_rag_chunks_document_active');
    expect(sql).toContain('uq_rag_chunks_document_chunk_index_active');
    expect(sql.match(/WHERE deleted_at IS NULL/g)).toHaveLength(4);
    expect(sql.match(/ON DELETE RESTRICT/g)).toHaveLength(2);
    expect(sql).not.toMatch(/USING (hnsw|ivfflat)/i);

    expect(statements.slice(2, 6)).toEqual([
      expect.stringContaining('INDEX "idx_rag_documents_product_active"'),
      expect.stringContaining(
        'INDEX "uq_rag_documents_product_content_hash_active"',
      ),
      expect.stringContaining('INDEX "idx_rag_chunks_document_active"'),
      expect.stringContaining(
        'INDEX "uq_rag_chunks_document_chunk_index_active"',
      ),
    ]);
    expect(statements.slice(6)).toEqual([
      expect.stringContaining('CONSTRAINT "fk_rag_documents_product"'),
      expect.stringContaining('CONSTRAINT "fk_rag_chunks_document"'),
    ]);
  });

  it('rolls back chunks before documents without touching products or vector', async () => {
    await migration.down(queryRunner);
    const statements = query.mock.calls.map(([statement]) => statement);

    expect(statements).toEqual([
      expect.stringContaining(
        'ALTER TABLE "rag_chunks" DROP CONSTRAINT "fk_rag_chunks_document"',
      ),
      expect.stringContaining(
        'DROP INDEX "public"."uq_rag_chunks_document_chunk_index_active"',
      ),
      expect.stringContaining(
        'DROP INDEX "public"."idx_rag_chunks_document_active"',
      ),
      'DROP TABLE "rag_chunks"',
      expect.stringContaining(
        'ALTER TABLE "rag_documents" DROP CONSTRAINT "fk_rag_documents_product"',
      ),
      expect.stringContaining(
        'DROP INDEX "public"."uq_rag_documents_product_content_hash_active"',
      ),
      expect.stringContaining(
        'DROP INDEX "public"."idx_rag_documents_product_active"',
      ),
      'DROP TABLE "rag_documents"',
    ]);
    expect(statements.join('\n')).not.toContain('DROP TABLE "products"');
    expect(statements.join('\n')).not.toContain('DROP EXTENSION');
  });
});
