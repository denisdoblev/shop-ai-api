import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EMBEDDING_DIMENSIONS } from '../embeddings/embedding.constants';
import { RagDocument } from './rag-document.entity';

@Entity('rag_chunks')
@Index('idx_rag_chunks_document_active', ['documentId'], {
  where: 'deleted_at IS NULL',
})
@Index(
  'uq_rag_chunks_document_chunk_index_active',
  ['documentId', 'chunkIndex'],
  {
    unique: true,
    where: 'deleted_at IS NULL',
  },
)
@Index('idx_rag_chunks_embedding_hnsw_active', { synchronize: false })
@Check('chk_rag_chunks_content_not_empty', "btrim(content) <> ''")
@Check('chk_rag_chunks_chunk_index', 'chunk_index >= 0')
@Check('chk_rag_chunks_page_start', 'page_start IS NULL OR page_start > 0')
@Check('chk_rag_chunks_page_end', 'page_end IS NULL OR page_end > 0')
@Check(
  'chk_rag_chunks_page_range',
  'page_start IS NULL OR page_end IS NULL OR page_end >= page_start',
)
@Check('chk_rag_chunks_token_count', 'token_count IS NULL OR token_count >= 0')
@Check('chk_rag_chunks_metadata_object', "jsonb_typeof(metadata) = 'object'")
@Check(
  'chk_rag_chunks_embedding_state',
  "(embedding IS NULL AND embedding_model IS NULL AND embedded_at IS NULL) OR (embedding IS NOT NULL AND embedding_model IS NOT NULL AND btrim(embedding_model) <> '' AND embedded_at IS NOT NULL)",
)
export class RagChunk extends BaseEntity {
  @Column({ type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => RagDocument, (document) => document.chunks, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'document_id',
    foreignKeyConstraintName: 'fk_rag_chunks_document',
  })
  document!: RagDocument;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'integer' })
  chunkIndex!: number;

  @Column({ type: 'integer', nullable: true })
  pageStart!: number | null;

  @Column({ type: 'integer', nullable: true })
  pageEnd!: number | null;

  @Column({ type: 'text', nullable: true })
  section!: string | null;

  @Column({ type: 'integer', nullable: true })
  tokenCount!: number | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ type: 'vector', length: EMBEDDING_DIMENSIONS, nullable: true })
  embedding!: number[] | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  embeddingModel!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  embeddedAt!: Date | null;
}
