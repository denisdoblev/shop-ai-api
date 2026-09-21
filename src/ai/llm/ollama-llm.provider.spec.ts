import { LlmProviderError } from './llm-provider.error';
import { OllamaLlmProvider } from './ollama-llm.provider';

describe('OllamaLlmProvider', () => {
  const options = {
    baseUrl: 'http://localhost:11434',
    model: 'qwen3:8b',
    timeoutMs: 120_000,
  };
  const input = {
    systemPrompt: 'Use only sources.',
    prompt: 'SOURCES\nManual\nQUESTION\nCan I mute it?',
  };
  let provider: OllamaLlmProvider;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    provider = new OllamaLlmProvider(options);
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('sends a non-streaming chat request without thinking', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'qwen3:8b',
          message: { role: 'assistant', content: ' Yes, it has a button. ' },
          done: true,
        }),
      ),
    );

    await expect(provider.generate(input)).resolves.toEqual({
      text: 'Yes, it has a button.',
      model: 'qwen3:8b',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('http://localhost:11434/api/chat'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen3:8b',
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.prompt },
          ],
          stream: false,
          think: false,
          options: { temperature: 0 },
        }),
      }),
    );
  });

  it.each([
    ['invalid JSON', new Response('{')],
    [
      'missing model',
      new Response(
        JSON.stringify({ message: { content: 'answer' }, done: true }),
      ),
    ],
    [
      'empty content',
      new Response(
        JSON.stringify({
          model: 'qwen3:8b',
          message: { content: '  ' },
          done: true,
        }),
      ),
    ],
    [
      'unfinished response',
      new Response(
        JSON.stringify({
          model: 'qwen3:8b',
          message: { content: 'answer' },
          done: false,
        }),
      ),
    ],
  ])('rejects %s', async (_, response) => {
    fetchMock.mockResolvedValue(response);

    await expect(provider.generate(input)).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('normalizes failed HTTP responses', async () => {
    fetchMock.mockResolvedValue(new Response('secret body', { status: 503 }));

    await expect(provider.generate(input)).rejects.toEqual(
      new LlmProviderError('upstream_error', 'LLM provider returned HTTP 503'),
    );
  });

  it('normalizes network failures without exposing prompts', async () => {
    fetchMock.mockRejectedValue(new Error(`failure: ${input.prompt}`));

    const request = provider.generate(input);
    await expect(request).rejects.toEqual(
      new LlmProviderError('unavailable', 'LLM provider is unavailable'),
    );
    await expect(request).rejects.not.toThrow(input.prompt);
  });

  it('normalizes request timeouts', async () => {
    jest.useFakeTimers();
    provider = new OllamaLlmProvider({ ...options, timeoutMs: 10 });
    fetchMock.mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    });

    const request = provider.generate(input);
    const expectation = expect(request).rejects.toMatchObject({
      code: 'timeout',
    });
    await jest.advanceTimersByTimeAsync(10);

    await expectation;
  });

  it('rejects empty prompts before making a request', async () => {
    await expect(
      provider.generate({ ...input, prompt: '  ' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
