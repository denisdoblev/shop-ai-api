import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('categories')
@Index('uq_categories_slug_active', ['slug'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Check('chk_categories_not_self_parent', 'parent_id IS NULL OR parent_id <> id')
export class Category extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => Category, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'parent_id',
    foreignKeyConstraintName: 'fk_categories_parent',
  })
  parent!: Category | null;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 120 })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
