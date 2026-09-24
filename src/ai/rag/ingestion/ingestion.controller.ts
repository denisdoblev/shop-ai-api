import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators';
import { ValidRoles } from '../../../auth/interfaces';
import { CreateRagDocumentDto, RagDocumentResponseDto } from './dto';
import { IngestionService } from './ingestion.service';

@ApiTags('products')
@Controller('products/:productId/rag-documents')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post()
  @Auth(ValidRoles.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Ingest a local PDF for product RAG' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        chunkSize: {
          type: 'integer',
          minimum: 200,
          maximum: 4000,
          default: 400,
        },
        chunkOverlap: { type: 'integer', minimum: 0, default: 80 },
      },
    },
  })
  @ApiCreatedResponse({ type: RagDocumentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid PDF or chunk configuration' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiConflictResponse({ description: 'An active document has the same hash' })
  @ApiServiceUnavailableResponse({
    description: 'Embedding provider unavailable',
  })
  create(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() options: CreateRagDocumentDto,
  ): Promise<RagDocumentResponseDto> {
    if (!file) throw new BadRequestException('PDF file is required');
    return this.ingestionService.ingestPdf(productId, file, options);
  }
}
