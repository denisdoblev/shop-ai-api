import { LlmProviderError } from './llm-provider.error';
import { LlmProvider } from './llm-provider.interface';
import { LlmService } from './llm.service';

describe('LlmService', () => {
  const provider = {
    chat: jest.fn(),
  };
  const service = new LlmService(provider as jest.Mocked<LlmProvider>);
  const input = { systemPrompt: 'system', prompt: 'user' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates once and returns the provider-neutral output', async () => {
    provider.chat.mockResolvedValue({
      message: { role: 'assistant', content: 'answer' },
      model: 'qwen3:8b',
    });

    await expect(service.generate(input)).resolves.toEqual({
      text: 'answer',
      model: 'qwen3:8b',
    });
    expect(provider.chat).toHaveBeenCalledTimes(1);
    expect(provider.chat).toHaveBeenCalledWith({
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.prompt },
      ],
    });
  });

  it('propagates normalized provider errors', async () => {
    const error = new LlmProviderError('timeout', 'timed out');
    provider.chat.mockRejectedValue(error);

    await expect(service.generate(input)).rejects.toBe(error);
  });
});
