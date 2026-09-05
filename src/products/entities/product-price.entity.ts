import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from './product.entity';

@Entity('product_prices')
@Index('uq_product_price_recorded_at_active', ['productId', 'recordedAt'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index('idx_product_prices_history', ['productId', 'recordedAt'], {
  where: 'deleted_at IS NULL',
})
@Check('chk_product_prices_price', 'price >= 0')
@Check('chk_product_prices_currency_uppercase', 'currency = UPPER(currency)')
export class ProductPrice extends BaseEntity {
  @Column({ type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_product_prices_product',
  })
  product!: Product;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price!: string;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  @Column({ type: 'timestamp with time zone' })
  recordedAt!: Date;
}
