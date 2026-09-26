import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiGatewayTimeoutResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Auth, GetUser } from '../../auth/decorators';
import { ChatService } from './chat.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';

@ApiTags('ai')
@Controller('ai/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: 5,
      ttl: 60_000,
      getTracker: getAuthenticatedUserTracker,
    },
  })
  @Auth()
  @ApiOperation({
    summary: 'Chat about one server-bound product using explicit tools',
  })
  @ApiOkResponse({ type: ChatResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiServiceUnavailableResponse({
    description: 'AI dependency unavailable or tool limit reached',
  })
  @ApiGatewayTimeoutResponse({ description: 'Generation provider timed out' })
  @ApiTooManyRequestsResponse({
    description: 'Per-user rate or concurrency limit exceeded',
  })
  @ApiInternalServerErrorResponse({ description: 'Unexpected internal error' })
  answer(
    @Body() input: ChatRequestDto,
    @GetUser('id') userId: string,
  ): Promise<ChatResponseDto> {
    return this.chatService.answer({
      message: input.message,
      currentProductId: input.context.currentProductId,
      userId,
    });
  }
}

function getAuthenticatedUserTracker(
  request: Record<string, unknown>,
): Promise<string> {
  const user = request.user;
  if (
    typeof user !== 'object' ||
    user === null ||
    !('id' in user) ||
    typeof user.id !== 'string'
  ) {
    throw new UnauthorizedException('User not found in request');
  }
  return Promise.resolve(user.id);
}
