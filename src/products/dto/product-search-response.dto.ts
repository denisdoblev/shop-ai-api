import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductPriceRange } from './product-search-query.dto';

export class ProductSearchReferenceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ProductSearchImageDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uri' })
  url!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  altText!: string | null;
}

export class ProductSearchPriceDto {
  @ApiProperty({ example: 1299.99 })
  price!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  recordedAt!: Date;
}

export class ProductSearchItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  model!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: ProductSearchReferenceDto })
  brand!: ProductSearchReferenceDto;

  @ApiProperty({ type: ProductSearchReferenceDto })
  category!: ProductSearchReferenceDto;

  @ApiPropertyOptional({ type: ProductSearchImageDto, nullable: true })
  image!: ProductSearchImageDto | null;

  @ApiPropertyOptional({ type: ProductSearchPriceDto, nullable: true })
  price!: ProductSearchPriceDto | null;
}

export class ProductSearchFacetDto extends ProductSearchReferenceDto {
  @ApiProperty({ minimum: 0 })
  count!: number;
}

export class ProductSearchPriceFacetDto {
  @ApiProperty({ enum: ProductPriceRange })
  id!: ProductPriceRange;

  @ApiProperty()
  label!: string;

  @ApiProperty({ minimum: 0 })
  count!: number;
}

export class ProductSearchFacetsDto {
  @ApiProperty({ type: ProductSearchFacetDto, isArray: true })
  categories!: ProductSearchFacetDto[];

  @ApiProperty({ type: ProductSearchPriceFacetDto, isArray: true })
  prices!: ProductSearchPriceFacetDto[];

  @ApiProperty({ type: ProductSearchFacetDto, isArray: true })
  features!: ProductSearchFacetDto[];
}

export class ProductSearchPaginationDto {
  @ApiProperty({ minimum: 1 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  offset!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;
}

export class ProductSearchResponseDto {
  @ApiProperty({ type: ProductSearchItemDto, isArray: true })
  items!: ProductSearchItemDto[];

  @ApiProperty({ type: ProductSearchFacetsDto })
  facets!: ProductSearchFacetsDto;

  @ApiProperty({ type: ProductSearchPaginationDto })
  pagination!: ProductSearchPaginationDto;
}
