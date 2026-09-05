import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const MAX_PAGE_SIZE = 100;

export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @Type(() => Number)
  @ApiProperty({
    example: 10,
    default: 10,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    description: 'Limit',
    required: false,
  })
  limit = 10;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @ApiProperty({
    example: 0,
    default: 0,
    minimum: 0,
    description: 'Offset',
    required: false,
  })
  offset = 0;
}
