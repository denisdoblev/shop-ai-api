import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto';

export class AttributeQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'battery',
    maxLength: 100,
    description: 'Case-insensitive partial match on the attribute name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
