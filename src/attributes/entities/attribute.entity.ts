import { Check, Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { AttributeDataType } from './attribute-data-type.enum';

@Entity('attributes')
@Index('uq_attributes_slug_active', ['slug'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Check(
  'chk_attributes_data_type',
  "data_type IN ('string', 'number', 'boolean')",
)
export class Attribute extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 160 })
  slug!: string;

  @Column({ type: 'varchar', length: 20 })
  dataType!: AttributeDataType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit!: string | null;
}
