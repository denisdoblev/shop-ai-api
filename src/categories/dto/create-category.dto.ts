import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Active parent category ID',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiProperty({ example: 'Headphones', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'headphones', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  slug!: string;

  @ApiPropertyOptional({
    example: 'Over-ear, on-ear, and in-ear headphones.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  description?: string | null;
}
