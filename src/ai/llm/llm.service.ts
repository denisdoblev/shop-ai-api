import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDER } from './llm-provider.interface';
import type {
  GenerateInput,
  GenerateOutput,
  LlmChatInput,
  LlmChatOutput,
  LlmProvider,
} from './llm-provider.interface';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    @Inject(LLM_PROVIDER)
    private readonly provider: LlmProvider,
  ) {}

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    const output = await this.chat({
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.prompt },
      ],
    });

    return { text: output.message.content, model: output.model };
  }

  async chat(input: LlmChatInput): Promise<LlmChatOutput> {
    const startedAt = Date.now();

    try {
      const output = await this.provider.chat(input);
      this.logger.debug({
        event: 'llm_generation_completed',
        model: output.model,
        durationMs: Date.now() - startedAt,
      });
      return output;
    } catch (error: unknown) {
      this.logger.error({
        event: 'llm_generation_failed',
        errorCode: this.getErrorCode(error),
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  private getErrorCode(error: unknown): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
    ) {
      return error.code;
    }

    return 'unknown';
  }
}
