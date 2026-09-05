import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ example: 'Sony', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'sony', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  slug!: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/brands/sony.svg',
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  logoUrl?: string | null;
}
