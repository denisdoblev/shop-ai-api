import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Brand } from '../../brands/entities/brand.entity';
import { Category } from '../../categories/entities/category.entity';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('products')
@Index('uq_products_slug_active', ['slug'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index('idx_products_brand', ['brandId'], { where: 'deleted_at IS NULL' })
@Index('idx_products_category', ['categoryId'], { where: 'deleted_at IS NULL' })
export class Product extends BaseEntity {
  @Column({ type: 'uuid' })
  brandId!: string;

  @ManyToOne(() => Brand, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'brand_id',
    foreignKeyConstraintName: 'fk_products_brand',
  })
  brand!: Brand;

  @Column({ type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'category_id',
    foreignKeyConstraintName: 'fk_products_category',
  })
  category!: Category;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 220 })
  slug!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  model!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
