import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateCategoryAttributeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  attributeId!: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number = 0;
}
