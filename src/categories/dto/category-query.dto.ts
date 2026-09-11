import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto';

export class CategoryQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'audio',
    maxLength: 100,
    description: 'Case-insensitive partial match on the category name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
