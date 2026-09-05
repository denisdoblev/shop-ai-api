import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Attribute } from '../../attributes/entities/attribute.entity';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from './product.entity';
@Entity('product_specifications')
@Index('uq_product_specification_active', ['productId', 'attributeId'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index(
  'idx_product_specifications_boolean',
  ['attributeId', 'booleanValue', 'productId'],
  { where: 'deleted_at IS NULL AND boolean_value IS NOT NULL' },
)
@Index(
  'idx_product_specifications_numeric',
  ['attributeId', 'numericValue', 'productId'],
  { where: 'deleted_at IS NULL AND numeric_value IS NOT NULL' },
)
@Index(
  'idx_product_specifications_string',
  ['attributeId', 'stringValue', 'productId'],
  { where: 'deleted_at IS NULL AND string_value IS NOT NULL' },
)
@Check(
  'chk_product_specifications_single_value',
  '((CASE WHEN string_value IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN numeric_value IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN boolean_value IS NOT NULL THEN 1 ELSE 0 END)) = 1',
)
export class ProductSpecification extends BaseEntity {
  @Column({ type: 'uuid' }) productId!: string;
  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_product_specifications_product',
  })
  product!: Product;
  @Column({ type: 'uuid' }) attributeId!: string;
  @ManyToOne(() => Attribute, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'attribute_id',
    foreignKeyConstraintName: 'fk_product_specifications_attribute',
  })
  attribute!: Attribute;
  @Column({ type: 'text', nullable: true }) stringValue!: string | null;
  @Column({ type: 'numeric', nullable: true }) numericValue!: string | null;
  @Column({ type: 'boolean', nullable: true }) booleanValue!: boolean | null;
}
