import {
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProductsService } from '../../products/products.service';
import { LlmProviderError } from '../llm/llm-provider.error';
import { LlmMessage, LlmToolCall } from '../llm/llm-provider.interface';
import { LlmService } from '../llm/llm.service';
import { INSUFFICIENT_INFORMATION_ANSWER } from '../rag/grounding-prompt';
import { RagSource } from '../rag/rag.service';
import { CHAT_SYSTEM_PROMPT } from './chat-prompt';
import { ChatToolResult } from './tools/chat-tool';
import { ChatToolRegistry } from './tools/chat-tool.registry';

export interface ChatInput {
  message: string;
  currentProductId: string;
  userId: string;
}
export interface ChatAnswer {
  answer: string;
  sources: RagSource[];
}

const MAX_TOOL_ROUNDS = 3;
const MAX_CALLS_PER_ROUND = 4;
const MAX_TOTAL_CALLS = 8;
const MAX_CHAT_DURATION_MS = 150_000;
const MAX_CONCURRENT_CHAT_REQUESTS = 4;
const TOOL_REQUIRED_RETRY_PROMPT = `La solicitud no es conversación trivial. No respondas todavía: consultá al menos una herramienta válida antes de dar una respuesta final.`;
const TRIVIAL_CONVERSATION =
  /^(?:hola|buen(?:os d[ií]as|as tardes|as noches)|gracias|muchas gracias|adi[oó]s|hasta luego|hello|hi|thanks|thank you|bye)[\s!,.¿?¡]*$/iu;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly activeUsers = new Set<string>();

  constructor(
    private readonly llmService: LlmService,
    private readonly productsService: ProductsService,
    private readonly registry: ChatToolRegistry,
  ) {}

  async answer(input: ChatInput): Promise<ChatAnswer> {
    if (this.activeUsers.has(input.userId)) {
      throw new HttpException(
        'Only one concurrent AI chat request is allowed per user',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (this.activeUsers.size >= MAX_CONCURRENT_CHAT_REQUESTS) {
      throw new HttpException(
        'AI chat concurrency limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.activeUsers.add(input.userId);
    const operation = this.answerWithinDeadline(input);
    void operation.then(
      () => this.activeUsers.delete(input.userId),
      () => this.activeUsers.delete(input.userId),
    );
    return this.enforceDeadline(operation);
  }

  private async answerWithinDeadline(input: ChatInput): Promise<ChatAnswer> {
    const startedAt = Date.now();
    await this.productsService.findOne(input.currentProductId);
    const messages: LlmMessage[] = [
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      { role: 'user', content: input.message.trim() },
    ];
    const sources = new Map<string, RagSource>();
    let totalCalls = 0;
    let successfulToolCalls = 0;
    let requiredToolRetryUsed = false;
    this.logger.debug({
      event: 'ai_chat_started',
      productId: input.currentProductId,
    });
    try {
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
        const output = await this.chat(messages);
        const calls = output.message.toolCalls ?? [];
        if (calls.length === 0) {
          if (output.message.content.length === 0)
            throw new ServiceUnavailableException('LLM returned no answer');
          if (
            successfulToolCalls === 0 &&
            !this.isTrivialConversation(input.message)
          ) {
            if (requiredToolRetryUsed)
              throw new ServiceUnavailableException('tool_required');
            requiredToolRetryUsed = true;
            messages.push(output.message, {
              role: 'system',
              content: TOOL_REQUIRED_RETRY_PROMPT,
            });
            continue;
          }
          const answer = output.message.content;
          const responseSources =
            answer === INSUFFICIENT_INFORMATION_ANSWER
              ? []
              : [...sources.values()];
          this.logger.debug({
            event: 'ai_chat_completed',
            productId: input.currentProductId,
            totalDurationMs: Date.now() - startedAt,
            sourcesCount: responseSources.length,
          });
          return {
            answer,
            sources: responseSources,
          };
        }
        if (round === MAX_TOOL_ROUNDS)
          throw new ServiceUnavailableException('tool_round_limit');
        if (
          calls.length > MAX_CALLS_PER_ROUND ||
          totalCalls + calls.length > MAX_TOTAL_CALLS
        )
          throw new ServiceUnavailableException('tool_call_limit');
        totalCalls += calls.length;
        messages.push(output.message);
        const results = await this.executeRound(
          calls,
          input.currentProductId,
          round + 1,
        );
        successfulToolCalls += results.filter(
          (result) => result.executed,
        ).length;
        results.forEach((result) =>
          result.value.sources.forEach((source) =>
            sources.set(source.chunkId, source),
          ),
        );
        calls.forEach((call, index) =>
          messages.push({
            role: 'tool',
            toolName: call.name,
            content: JSON.stringify(
              results[index]?.value.output ?? {
                ok: false,
                error: { code: 'tool_failed' },
              },
            ),
          }),
        );
      }
      throw new ServiceUnavailableException('tool_round_limit');
    } catch (error: unknown) {
      this.logger.error({
        event: 'ai_chat_failed',
        productId: input.currentProductId,
        totalDurationMs: Date.now() - startedAt,
        errorCode: this.errorCode(error),
      });
      throw error;
    }
  }

  private async executeRound(
    calls: LlmToolCall[],
    productId: string,
    round: number,
  ): Promise<Array<{ value: ChatToolResult; executed: boolean }>> {
    const unique = new Map<
      string,
      Promise<{ value: ChatToolResult; executed: boolean }>
    >();
    for (const [index, call] of calls.entries()) {
      this.logger.debug({
        event: 'ai_tool_requested',
        productId,
        toolName: call.name,
        toolRound: round,
        toolCallIndex: index,
        toolCallCount: calls.length,
      });
      const key = `${call.name}:${JSON.stringify(call.arguments)}`;
      if (!unique.has(key))
        unique.set(
          key,
          this.executeTool(call, productId, round, index, calls.length),
        );
    }
    const settled = await Promise.allSettled(
      calls.map(
        (call) => unique.get(`${call.name}:${JSON.stringify(call.arguments)}`)!,
      ),
    );
    return settled.map((result) => {
      if (result.status === 'rejected') throw result.reason;
      return result.value;
    });
  }

  private async executeTool(
    call: LlmToolCall,
    productId: string,
    round: number,
    index: number,
    count: number,
  ): Promise<{ value: ChatToolResult; executed: boolean }> {
    const startedAt = Date.now();
    const tool = this.registry.get(call.name);
    if (!tool || !tool.validate(call.arguments))
      return {
        value: {
          output: { ok: false, error: { code: 'invalid_arguments' } },
          sources: [],
        },
        executed: false,
      };
    try {
      const result = await tool.execute(call.arguments, {
        currentProductId: productId,
      });
      this.logger.debug({
        event: 'ai_tool_completed',
        productId,
        toolName: call.name,
        toolRound: round,
        toolCallIndex: index,
        toolCallCount: count,
        durationMs: Date.now() - startedAt,
        outcome: 'success',
      });
      return { value: result, executed: true };
    } catch (error: unknown) {
      this.logger.error({
        event: 'ai_tool_failed',
        productId,
        toolName: call.name,
        toolRound: round,
        toolCallIndex: index,
        toolCallCount: count,
        durationMs: Date.now() - startedAt,
        outcome: 'failed',
        errorCode: this.errorCode(error),
      });
      throw error;
    }
  }

  private async chat(messages: LlmMessage[]) {
    try {
      return await this.llmService.chat({
        messages,
        tools: this.registry.definitions(),
      });
    } catch (error: unknown) {
      if (error instanceof LlmProviderError) {
        if (error.code === 'timeout')
          throw new GatewayTimeoutException('Generation provider timed out');
        throw new ServiceUnavailableException(
          'Generation provider is unavailable',
        );
      }
      throw error;
    }
  }

  private isTrivialConversation(message: string): boolean {
    return TRIVIAL_CONVERSATION.test(message.trim());
  }

  private enforceDeadline(operation: Promise<ChatAnswer>): Promise<ChatAnswer> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new GatewayTimeoutException('AI chat deadline exceeded')),
        MAX_CHAT_DURATION_MS,
      );
      operation.then(
        (answer) => {
          clearTimeout(timeout);
          resolve(answer);
        },
        (error: unknown) => {
          clearTimeout(timeout);
          reject(error instanceof Error ? error : new Error('AI chat failed'));
        },
      );
    });
  }

  private errorCode(error: unknown): string {
    return typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
      ? error.code
      : 'unknown';
  }
}
