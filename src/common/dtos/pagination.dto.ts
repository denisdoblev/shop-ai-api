import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsPositive, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  @ApiProperty({
    example: 10,
    default: 10,
    description: 'Limit',
    required: false,
  })
  limit?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  @ApiProperty({
    example: 0,
    default: 0,
    description: 'Offset',
    required: false,
  })
  offset?: number;
}
