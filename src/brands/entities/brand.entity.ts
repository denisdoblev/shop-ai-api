import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('brands')
@Index('uq_brands_name_active', { synchronize: false })
@Index('uq_brands_slug_active', ['slug'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
export class Brand extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 120 })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  logoUrl!: string | null;
}
