export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface GenerateInput {
  systemPrompt: string;
  prompt: string;
}

export interface GenerateOutput {
  text: string;
  model: string;
}

export type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | {
      role: 'assistant';
      content: string;
      toolCalls?: LlmToolCall[];
    }
  | { role: 'tool'; content: string; toolName: string };

export interface LlmToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmChatInput {
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
}

export interface LlmChatOutput {
  message: Extract<LlmMessage, { role: 'assistant' }>;
  model: string;
}

export interface LlmProvider {
  chat(input: LlmChatInput): Promise<LlmChatOutput>;
}
