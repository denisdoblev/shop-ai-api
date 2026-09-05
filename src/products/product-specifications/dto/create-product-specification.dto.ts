import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsUUID } from 'class-validator';
export class CreateProductSpecificationDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() attributeId!: string;
  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
  })
  @IsDefined()
  value!: unknown;
}
