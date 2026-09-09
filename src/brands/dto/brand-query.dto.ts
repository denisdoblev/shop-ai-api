import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto';

export class BrandQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'son',
    maxLength: 100,
    description: 'Case-insensitive partial match on the brand name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
