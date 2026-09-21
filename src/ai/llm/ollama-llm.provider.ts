import { LlmProviderError } from './llm-provider.error';
import {
  GenerateInput,
  GenerateOutput,
  LlmProvider,
} from './llm-provider.interface';

export interface OllamaLlmProviderOptions {
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

interface OllamaChatResponse {
  model: string;
  message: {
    content: string;
  };
  done: true;
}

export class OllamaLlmProvider implements LlmProvider {
  constructor(private readonly options: OllamaLlmProviderOptions) {}

  async generate(input: GenerateInput): Promise<GenerateOutput> {
    this.assertInput(input);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs,
    );

    try {
      const response = await fetch(new URL('/api/chat', this.options.baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.options.model,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.prompt },
          ],
          stream: false,
          think: false,
          options: { temperature: 0 },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new LlmProviderError(
          'upstream_error',
          `LLM provider returned HTTP ${response.status}`,
        );
      }

      const payload = await this.parseResponse(response);
      return {
        text: payload.message.content.trim(),
        model: payload.model,
      };
    } catch (error: unknown) {
      if (error instanceof LlmProviderError) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new LlmProviderError('timeout', 'LLM provider request timed out');
      }
      throw new LlmProviderError('unavailable', 'LLM provider is unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertInput(input: GenerateInput): void {
    if (
      input.systemPrompt.trim().length === 0 ||
      input.prompt.trim().length === 0
    ) {
      throw new LlmProviderError(
        'invalid_input',
        'LLM prompts must not be empty',
      );
    }
  }

  private async parseResponse(response: Response): Promise<OllamaChatResponse> {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new LlmProviderError(
        'invalid_response',
        'LLM provider returned invalid JSON',
      );
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('model' in payload) ||
      typeof payload.model !== 'string' ||
      payload.model.trim().length === 0 ||
      !('done' in payload) ||
      payload.done !== true ||
      !('message' in payload) ||
      typeof payload.message !== 'object' ||
      payload.message === null ||
      !('content' in payload.message) ||
      typeof payload.message.content !== 'string' ||
      payload.message.content.trim().length === 0
    ) {
      throw new LlmProviderError(
        'invalid_response',
        'LLM provider returned an invalid response',
      );
    }

    return {
      model: payload.model,
      message: { content: payload.message.content },
      done: true,
    };
  }
}
