import { ApiProperty } from '@nestjs/swagger';
import { RagDocumentSourceType } from '../../entities/rag-document-source-type.enum';
import { RagDocumentStatus } from '../../entities/rag-document-status.enum';

export class RagDocumentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: RagDocumentSourceType })
  sourceType!: RagDocumentSourceType;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ enum: RagDocumentStatus })
  status!: RagDocumentStatus;

  @ApiProperty()
  pageCount!: number;

  @ApiProperty()
  chunkCount!: number;

  @ApiProperty({ example: '48213', description: 'Decimal byte count' })
  fileSizeBytes!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  processedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}
