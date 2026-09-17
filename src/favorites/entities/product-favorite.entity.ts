import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { BaseEntity } from '../../common/entities/base.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('product_favorites')
@Index('uq_product_favorites_active', ['userId', 'productId'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index('idx_product_favorites_user_active', ['userId'], {
  where: 'deleted_at IS NULL',
})
export class ProductFavorite extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_product_favorites_user',
  })
  user!: User;

  @Column({ type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'product_id',
    foreignKeyConstraintName: 'fk_product_favorites_product',
  })
  product!: Product;
}
