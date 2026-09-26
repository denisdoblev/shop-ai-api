import { LlmToolDefinition } from '../../llm/llm-provider.interface';
import { RagSource } from '../../rag/rag.service';

export interface ToolExecutionContext {
  currentProductId: string;
}
export interface ChatToolResult {
  output: Record<string, unknown>;
  sources: RagSource[];
}

export interface ChatTool {
  readonly definition: LlmToolDefinition;
  validate(argumentsValue: Record<string, unknown>): boolean;
  execute(
    argumentsValue: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ChatToolResult>;
}
