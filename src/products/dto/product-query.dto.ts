import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from '../../common/dto';

export class ProductQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Attribute to filter through product specifications',
  })
  @IsOptional()
  @IsUUID()
  specAttributeId?: string;

  @ApiPropertyOptional({ description: 'Exact string specification value' })
  @IsOptional()
  @IsString()
  specStringValue?: string;

  @ApiPropertyOptional({
    description: 'Inclusive minimum numeric specification value',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  specNumberMin?: number;

  @ApiPropertyOptional({
    description: 'Inclusive maximum numeric specification value',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  specNumberMax?: number;

  @ApiPropertyOptional({ description: 'Exact boolean specification value' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  specBooleanValue?: boolean;
}
