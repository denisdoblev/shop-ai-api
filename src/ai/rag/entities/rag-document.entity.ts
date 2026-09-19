import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Product } from '../../../products/entities/product.entity';
import { RagChunk } from './rag-chunk.entity';
import { RagDocumentSourceType } from './rag-document-source-type.enum';
import { RagDocumentStatus } from './rag-document-status.enum';

@Entity('rag_documents')
@Index('idx_rag_documents_product_active', ['productId'], {
  where: 'deleted_at IS NULL',
})
@Index(
  'uq_rag_documents_product_content_hash_active',
  ['productId', 'contentHash'],
  {
    unique: true,
    where: 'deleted_at IS NULL',
  },
)
@Check('chk_rag_documents_source_type', "source_type IN ('pdf', 'text')")
@Check('chk_rag_documents_content_hash', "content_hash ~ '^[0-9A-Fa-f]{64}$'")
@Check(
  'chk_rag_documents_status',
  "status IN ('pending', 'processing', 'ready', 'failed')",
)
@Check('chk_rag_documents_page_count', 'page_count IS NULL OR page_count > 0')
@Check(
  'chk_rag_documents_file_size_bytes',
  'file_size_bytes IS NULL OR file_size_bytes >= 0',
)
@Check('chk_rag_documents_metadata_object', "jsonb_typeof(metadata) = 'object'")
export class RagDocument extends BaseEntity {
  @Column({ type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_rag_documents_product',
  })
  product!: Product;

  @OneToMany(() => RagChunk, (chunk) => chunk.document)
  chunks!: RagChunk[];

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: RagDocumentSourceType.PDF,
  })
  sourceType!: RagDocumentSourceType;

  @Column({ type: 'text', nullable: true })
  sourceUri!: string | null;

  @Column({ type: 'varchar', length: 100, default: 'application/pdf' })
  mimeType!: string;

  @Column({ type: 'char', length: 64 })
  contentHash!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: RagDocumentStatus.PENDING,
  })
  status!: RagDocumentStatus;

  @Column({ type: 'text', nullable: true })
  processingError!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @Column({ type: 'integer', nullable: true })
  pageCount!: number | null;

  @Column({ type: 'bigint', nullable: true })
  fileSizeBytes!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;
}
