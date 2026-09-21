import { LlmProviderError } from './llm-provider.error';
import { LlmProvider } from './llm-provider.interface';
import { LlmService } from './llm.service';

describe('LlmService', () => {
  const provider = {
    generate: jest.fn(),
  };
  const service = new LlmService(provider as jest.Mocked<LlmProvider>);
  const input = { systemPrompt: 'system', prompt: 'user' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates once and returns the provider-neutral output', async () => {
    provider.generate.mockResolvedValue({ text: 'answer', model: 'qwen3:8b' });

    await expect(service.generate(input)).resolves.toEqual({
      text: 'answer',
      model: 'qwen3:8b',
    });
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(provider.generate).toHaveBeenCalledWith(input);
  });

  it('propagates normalized provider errors', async () => {
    const error = new LlmProviderError('timeout', 'timed out');
    provider.generate.mockRejectedValue(error);

    await expect(service.generate(input)).rejects.toBe(error);
  });
});
