import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Attribute } from '../../attributes/entities/attribute.entity';
import { BaseEntity } from '../../common/entities/base.entity';
import { Category } from './category.entity';

@Entity('category_attributes')
@Index('uq_category_attribute_active', ['categoryId', 'attributeId'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Check('chk_category_attributes_position', 'position >= 0')
export class CategoryAttribute extends BaseEntity {
  @Column({ type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'category_id',
    foreignKeyConstraintName: 'fk_category_attributes_category',
  })
  category!: Category;

  @Column({ type: 'uuid' })
  attributeId!: string;

  @ManyToOne(() => Attribute, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'attribute_id',
    foreignKeyConstraintName: 'fk_category_attributes_attribute',
  })
  attribute!: Attribute;

  @Column({ type: 'integer', default: 0 })
  position!: number;
}
