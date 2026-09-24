import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiGatewayTimeoutResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from '../auth/decorators';
import { AskAiDto, AskAiResponseDto } from './dto';
import { RagService } from './rag/rag.service';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly ragService: RagService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @Auth()
  @ApiOperation({ summary: 'Answer one product question using grounded RAG' })
  @ApiOkResponse({ type: AskAiResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiServiceUnavailableResponse({
    description: 'Embedding or generation provider unavailable',
  })
  @ApiGatewayTimeoutResponse({ description: 'Generation provider timed out' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected internal error' })
  ask(@Body() input: AskAiDto): Promise<AskAiResponseDto> {
    return this.ragService.answer({
      productId: input.productId,
      question: input.question,
    });
  }
}
