import { LlmProviderError } from './llm-provider.error';
import {
  LlmChatInput,
  LlmChatOutput,
  LlmMessage,
  LlmToolCall,
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
    tool_calls?: Array<{
      function: { name: string; arguments: Record<string, unknown> };
    }>;
  };
  done: true;
}

export class OllamaLlmProvider implements LlmProvider {
  constructor(private readonly options: OllamaLlmProviderOptions) {}

  async chat(input: LlmChatInput): Promise<LlmChatOutput> {
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
          messages: input.messages.map((message) =>
            this.toOllamaMessage(message),
          ),
          ...(input.tools?.length
            ? {
                tools: input.tools.map((tool) => ({
                  type: 'function',
                  function: tool,
                })),
              }
            : {}),
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
        message: {
          role: 'assistant',
          content: payload.message.content.trim(),
          ...(payload.message.tool_calls
            ? {
                toolCalls: payload.message.tool_calls.map((call) => ({
                  name: call.function.name,
                  arguments: call.function.arguments,
                })),
              }
            : {}),
        },
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

  private assertInput(input: LlmChatInput): void {
    if (
      input.messages.length === 0 ||
      input.messages.some((message) => {
        if (message.role === 'assistant' && message.toolCalls?.length)
          return false;
        return message.content.trim().length === 0;
      })
    ) {
      throw new LlmProviderError(
        'invalid_input',
        'LLM prompts must not be empty',
      );
    }
  }

  private toOllamaMessage(message: LlmMessage): Record<string, unknown> {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        content: message.content,
        tool_name: message.toolName,
      };
    }
    if (message.role === 'assistant' && message.toolCalls?.length) {
      return {
        role: 'assistant',
        content: message.content,
        tool_calls: message.toolCalls.map((call) => ({
          function: { name: call.name, arguments: call.arguments },
        })),
      };
    }
    return message;
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
      !this.hasValidContentOrToolCalls(payload.message)
    ) {
      throw new LlmProviderError(
        'invalid_response',
        'LLM provider returned an invalid response',
      );
    }

    return {
      model: payload.model,
      message: {
        content: payload.message.content,
        ...(this.parseToolCalls(payload.message) ?? {}),
      },
      done: true,
    };
  }

  private hasValidContentOrToolCalls(message: object): boolean {
    if (!('content' in message) || typeof message.content !== 'string')
      return false;
    if ('tool_calls' in message) return this.parseToolCalls(message) !== null;
    return message.content.trim().length > 0;
  }

  private parseToolCalls(
    message: object,
  ): { tool_calls: OllamaChatResponse['message']['tool_calls'] } | null {
    const rawCalls = (message as Record<string, unknown>).tool_calls;
    if (!Array.isArray(rawCalls) || rawCalls.length === 0) {
      return null;
    }
    const calls: LlmToolCall[] = [];
    for (const value of rawCalls as unknown[]) {
      if (
        typeof value !== 'object' ||
        value === null ||
        !('function' in value) ||
        typeof (value as Record<string, unknown>).function !== 'object' ||
        (value as Record<string, unknown>).function === null
      )
        return null;
      const fn = (value as Record<string, unknown>).function as Record<
        string,
        unknown
      >;
      if (
        typeof fn.name !== 'string' ||
        fn.name.trim().length === 0 ||
        !this.isRecord(fn.arguments)
      )
        return null;
      calls.push({ name: fn.name, arguments: fn.arguments });
    }
    return {
      tool_calls: calls.map((call) => ({ function: call })),
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
