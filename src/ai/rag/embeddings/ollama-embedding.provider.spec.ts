import { EmbeddingProviderError } from './embedding-provider.error';
import {
  OLLAMA_EMBEDDING_DIMENSIONS,
  OllamaEmbeddingProvider,
} from './ollama-embedding.provider';

const validVector = (value = 0.5): number[] =>
  Array.from({ length: OLLAMA_EMBEDDING_DIMENSIONS }, () => value);

describe('OllamaEmbeddingProvider', () => {
  const options = {
    baseUrl: 'http://localhost:11434',
    model: 'embeddinggemma',
    timeoutMs: 30_000,
  };
  let provider: OllamaEmbeddingProvider;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    provider = new OllamaEmbeddingProvider(options);
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns an empty batch without making a request', async () => {
    await expect(provider.embed([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the model options and formats query and document batches', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ embeddings: [validVector(1), validVector(2)] }),
        { status: 200 },
      ),
    );

    const result = await provider.embed([
      { type: 'query', text: 'best laptop' },
      { type: 'document', title: 'Laptop', content: 'Product details' },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('http://localhost:11434/api/embed'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'embeddinggemma',
          input: [
            'task: search result | query: best laptop',
            'title: Laptop | text: Product details',
          ],
          dimensions: 768,
          truncate: false,
        }),
      }),
    );
    expect(result).toEqual([
      { values: validVector(1), model: 'embeddinggemma', dimensions: 768 },
      { values: validVector(2), model: 'embeddinggemma', dimensions: 768 },
    ]);
  });

  it('uses none for a document without a title', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ embeddings: [validVector()] })),
    );

    await provider.embed([{ type: 'document', content: 'Details' }]);

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe(
      JSON.stringify({
        model: 'embeddinggemma',
        input: ['title: none | text: Details'],
        dimensions: 768,
        truncate: false,
      }),
    );
  });

  it('supports a single query response', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ embeddings: [validVector(3)] })),
    );

    await expect(
      provider.embed([{ type: 'query', text: 'phone' }]),
    ).resolves.toEqual([
      { values: validVector(3), model: 'embeddinggemma', dimensions: 768 },
    ]);
  });

  it('normalizes request timeouts', async () => {
    jest.useFakeTimers();
    provider = new OllamaEmbeddingProvider({ ...options, timeoutMs: 10 });
    fetchMock.mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    });

    const request = provider.embed([{ type: 'query', text: 'phone' }]);
    const expectation = expect(request).rejects.toMatchObject({
      code: 'timeout',
    });
    await jest.advanceTimersByTimeAsync(10);

    await expectation;
  });

  it('normalizes network failures without exposing input', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED: secret text'));

    await expect(
      provider.embed([{ type: 'query', text: 'sensitive query' }]),
    ).rejects.toEqual(
      new EmbeddingProviderError(
        'unavailable',
        'Embedding provider is unavailable',
      ),
    );
  });

  it('normalizes failed HTTP responses', async () => {
    fetchMock.mockResolvedValue(new Response('failure', { status: 503 }));

    await expect(
      provider.embed([{ type: 'query', text: 'phone' }]),
    ).rejects.toMatchObject({ code: 'upstream_error' });
  });

  it.each([
    ['invalid JSON', new Response('{')],
    ['missing embeddings', new Response(JSON.stringify({ model: 'x' }))],
    [
      'wrong cardinality',
      new Response(
        JSON.stringify({ embeddings: [validVector(), validVector()] }),
      ),
    ],
    [
      'wrong dimensions',
      new Response(JSON.stringify({ embeddings: [[1, 2]] })),
    ],
  ])('rejects %s as an invalid response', async (_, response) => {
    fetchMock.mockResolvedValue(response);

    await expect(
      provider.embed([{ type: 'query', text: 'phone' }]),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('rejects non-finite vector values', async () => {
    const response = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        embeddings: [[Infinity, ...Array.from({ length: 767 }, () => 0)]],
      }),
    } as unknown as Response;
    fetchMock.mockResolvedValue(response);

    await expect(
      provider.embed([{ type: 'query', text: 'phone' }]),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('rejects empty content before making a request', async () => {
    await expect(
      provider.embed([{ type: 'document', content: '  ' }]),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
