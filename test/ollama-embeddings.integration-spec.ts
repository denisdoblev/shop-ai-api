import { EmbeddingVector } from '../src/ai/rag/embeddings/embedding-provider.interface';
import { OllamaEmbeddingProvider } from '../src/ai/rag/embeddings/ollama-embedding.provider';

const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'embeddinggemma';

const phrases = {
  a: 'Este auricular tiene un botón físico para silenciar el micrófono',
  b: 'El headset posee un botón de mute para el micrófono',
  c: 'La batería tiene una autonomía de 38 horas',
};

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    throw new Error(
      'Cosine similarity requires non-empty vectors of equal size',
    );
  }

  let dotProduct = 0;
  let leftSquaredMagnitude = 0;
  let rightSquaredMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    if (leftValue === undefined || rightValue === undefined) {
      throw new Error('Cosine similarity received an incomplete vector');
    }

    dotProduct += leftValue * rightValue;
    leftSquaredMagnitude += leftValue * leftValue;
    rightSquaredMagnitude += rightValue * rightValue;
  }

  const magnitude = Math.sqrt(leftSquaredMagnitude * rightSquaredMagnitude);
  if (magnitude === 0) {
    throw new Error('Cosine similarity is undefined for a zero vector');
  }

  return dotProduct / magnitude;
}

function expectValidEmbedding(embedding: EmbeddingVector): void {
  expect(embedding.values.length).toBeGreaterThan(0);
  expect(embedding.values.every(Number.isFinite)).toBe(true);
  expect(embedding.dimensions).toBe(embedding.values.length);
}

describe('Ollama embeddings integration', () => {
  jest.setTimeout(45_000);

  it('generates consistent embeddings that preserve semantic similarity', async () => {
    const provider = new OllamaEmbeddingProvider({
      baseUrl: OLLAMA_BASE_URL,
      model: OLLAMA_MODEL,
      timeoutMs: 30_000,
    });

    const embeddings = await provider.embed([
      { type: 'query', text: phrases.a },
      { type: 'query', text: phrases.b },
      { type: 'query', text: phrases.c },
    ]);

    expect(embeddings).toHaveLength(3);
    embeddings.forEach(expectValidEmbedding);
    expect(new Set(embeddings.map(({ dimensions }) => dimensions)).size).toBe(
      1,
    );

    const [embeddingA, embeddingB, embeddingC] = embeddings;
    if (
      embeddingA === undefined ||
      embeddingB === undefined ||
      embeddingC === undefined
    ) {
      throw new Error('Ollama did not return all requested embeddings');
    }

    expect(
      cosineSimilarity(embeddingA.values, embeddingB.values),
    ).toBeGreaterThan(cosineSimilarity(embeddingA.values, embeddingC.values));
  });
});
