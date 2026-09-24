import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AskAiSourceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  chunkId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  documentId!: string;

  @ApiProperty()
  @IsString()
  documentName!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  chunkIndex!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  pageStart!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  pageEnd!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  section!: string | null;
}

export class AskAiResponseDto {
  @ApiProperty()
  @IsString()
  answer!: string;

  @ApiProperty({ type: AskAiSourceDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AskAiSourceDto)
  sources!: AskAiSourceDto[];
}
