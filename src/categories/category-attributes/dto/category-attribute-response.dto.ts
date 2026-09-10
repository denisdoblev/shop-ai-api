import { ApiProperty } from '@nestjs/swagger';

export class CategoryAttributeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  attributeId!: string;

  @ApiProperty({ example: 'Battery life' })
  name!: string;

  @ApiProperty({ minimum: 0 })
  position!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}
