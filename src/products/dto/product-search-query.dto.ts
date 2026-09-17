import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto';

export enum ProductSearchSort {
  RELEVANCE = 'relevance',
  NAME_ASC = 'name-asc',
  NAME_DESC = 'name-desc',
  PRICE_ASC = 'price-asc',
  PRICE_DESC = 'price-desc',
  NEWEST = 'newest',
}

export enum ProductPriceRange {
  UNDER_500 = '<500',
  FROM_500_TO_999 = '500-999.99',
  FROM_1000_TO_1499 = '1000-1499.99',
  FROM_1500 = '>=1500',
}

function toArray({ value }: { value: unknown }): unknown[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [value];

  const values: unknown[] = [];
  for (const item of value as unknown[]) values.push(item);
  return values;
}

export class ProductSearchQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive product, model, or brand search',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  q?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    isArray: true,
    description: 'Repeated category IDs. Descendants are included.',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  categoryId?: string[];

  @ApiPropertyOptional({
    enum: ProductPriceRange,
    isArray: true,
    description: 'Repeated USD price bands combined with OR.',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(4)
  @IsEnum(ProductPriceRange, { each: true })
  priceRange?: ProductPriceRange[];

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    isArray: true,
    description: 'Repeated boolean attribute IDs combined with AND.',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  featureId?: string[];

  @ApiPropertyOptional({
    enum: ProductSearchSort,
    default: ProductSearchSort.RELEVANCE,
  })
  @IsOptional()
  @IsEnum(ProductSearchSort)
  sort: ProductSearchSort = ProductSearchSort.RELEVANCE;
}
