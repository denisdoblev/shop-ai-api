import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AttributeDataType } from '../entities/attribute-data-type.enum';

export class CreateAttributeDto {
  @ApiProperty({ example: 'Battery life', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'battery-life', maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  slug!: string;

  @ApiProperty({ enum: AttributeDataType, example: AttributeDataType.NUMBER })
  @IsEnum(AttributeDataType)
  dataType!: AttributeDataType;

  @ApiPropertyOptional({ example: 'hours', maxLength: 50, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string | null;
}
