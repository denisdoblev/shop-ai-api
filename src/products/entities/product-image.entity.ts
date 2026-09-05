import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from './product.entity';

@Entity('product_images')
@Index('uq_product_image_position_active', ['productId', 'position'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Check('chk_product_images_position', 'position >= 0')
export class ProductImage extends BaseEntity {
  @Column({ type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_product_images_product',
  })
  product!: Product;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  altText!: string | null;

  @Column({ type: 'integer', default: 0 })
  position!: number;
}
