export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface GenerateInput {
  systemPrompt: string;
  prompt: string;
}

export interface GenerateOutput {
  text: string;
  model: string;
}

export interface LlmProvider {
  generate(input: GenerateInput): Promise<GenerateOutput>;
}
