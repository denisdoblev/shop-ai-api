import {
  EmbeddingProvider,
  EmbeddingVector,
} from './embedding-provider.interface';
import { EmbeddingsService } from './embeddings.service';

const vector = (value: number): EmbeddingVector => ({
  values: [value],
  model: 'test-model',
  dimensions: 1,
});

describe('EmbeddingsService', () => {
  let provider: jest.Mocked<EmbeddingProvider>;
  let service: EmbeddingsService;

  beforeEach(() => {
    provider = { embed: jest.fn() };
    service = new EmbeddingsService(provider);
  });

  it('embeds a query through the provider', async () => {
    provider.embed.mockResolvedValue([vector(1)]);

    await expect(service.embedQuery('wireless headphones')).resolves.toEqual(
      vector(1),
    );
    expect(provider.embed.mock.calls).toEqual([
      [[{ type: 'query', text: 'wireless headphones' }]],
    ]);
  });

  it('rejects when the provider does not return a query vector', async () => {
    provider.embed.mockResolvedValue([]);

    await expect(service.embedQuery('wireless headphones')).rejects.toThrow(
      'Embedding provider did not return a query vector',
    );
    expect(provider.embed.mock.calls).toEqual([
      [[{ type: 'query', text: 'wireless headphones' }]],
    ]);
  });

  it('embeds document batches in their original order', async () => {
    provider.embed.mockResolvedValue([vector(1), vector(2)]);

    await expect(
      service.embedDocuments([
        { content: 'First', title: 'One' },
        { content: 'Second' },
      ]),
    ).resolves.toEqual([vector(1), vector(2)]);
    expect(provider.embed.mock.calls).toEqual([
      [
        [
          { type: 'document', content: 'First', title: 'One' },
          { type: 'document', content: 'Second' },
        ],
      ],
    ]);
  });

  it('passes an empty document batch through without changing its result', async () => {
    provider.embed.mockResolvedValue([]);

    await expect(service.embedDocuments([])).resolves.toEqual([]);
    expect(provider.embed.mock.calls).toEqual([[[]]]);
  });

  it.each([
    ['query', () => service.embedQuery('   ')],
    [
      'document',
      () => service.embedDocuments([{ title: 'Empty', content: '\n' }]),
    ],
  ])(
    'rejects empty %s content before calling the provider',
    async (_, call) => {
      await expect(call()).rejects.toThrow('must not be empty');
      expect(provider.embed.mock.calls).toHaveLength(0);
    },
  );
});
