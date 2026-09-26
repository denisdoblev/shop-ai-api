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

  async function generate() {
    const result = await provider.chat({
      messages: [
        { role: 'system' as const, content: input.systemPrompt },
        { role: 'user' as const, content: input.prompt },
      ],
    });
    return { text: result.message.content, model: result.model };
  }

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

    await expect(generate()).resolves.toEqual({
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

  it('serializes tools and accepts an empty assistant message with tool calls', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'qwen3:8b',
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [
              { function: { name: 'get_current_product', arguments: {} } },
            ],
          },
          done: true,
        }),
      ),
    );

    await expect(
      provider.chat({
        messages: [{ role: 'user', content: '¿Cuánto cuesta?' }],
        tools: [
          {
            name: 'get_current_product',
            description: 'Obtiene el producto',
            parameters: { type: 'object', properties: {} },
          },
        ],
      }),
    ).resolves.toEqual({
      model: 'qwen3:8b',
      message: {
        role: 'assistant',
        content: '',
        toolCalls: [{ name: 'get_current_product', arguments: {} }],
      },
    });
    expect(
      JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string),
    ).toMatchObject({
      tools: [{ type: 'function', function: { name: 'get_current_product' } }],
    });
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

    await expect(generate()).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('normalizes failed HTTP responses', async () => {
    fetchMock.mockResolvedValue(new Response('secret body', { status: 503 }));

    await expect(generate()).rejects.toEqual(
      new LlmProviderError('upstream_error', 'LLM provider returned HTTP 503'),
    );
  });

  it('normalizes network failures without exposing prompts', async () => {
    fetchMock.mockRejectedValue(new Error(`failure: ${input.prompt}`));

    const request = generate();
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

    const request = generate();
    const expectation = expect(request).rejects.toMatchObject({
      code: 'timeout',
    });
    await jest.advanceTimersByTimeAsync(10);

    await expectation;
  });

  it('rejects empty prompts before making a request', async () => {
    await expect(
      provider.chat({ messages: [{ role: 'user', content: '  ' }] }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
