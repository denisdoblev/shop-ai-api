import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttributeDataType } from '../entities/attribute-data-type.enum';

export class AttributeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Battery life' })
  name!: string;

  @ApiProperty({ example: 'battery-life' })
  slug!: string;

  @ApiProperty({ enum: AttributeDataType })
  dataType!: AttributeDataType;

  @ApiPropertyOptional({ example: 'hours', nullable: true })
  unit!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
