import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, Matches, Max, Min } from 'class-validator';

const MAX_PRODUCT_PRICE = 9_999_999_999.99;

export class CreateProductPriceDto {
  @ApiProperty({ example: 299.99, minimum: 0, maximum: MAX_PRODUCT_PRICE })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_PRODUCT_PRICE)
  price!: number;

  @ApiProperty({ example: 'USD', minLength: 3, maxLength: 3 })
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @ApiProperty({ example: '2026-08-29T20:00:00Z', format: 'date-time' })
  @IsDateString()
  recordedAt!: string;
}
