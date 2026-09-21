import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';
import { INSUFFICIENT_INFORMATION_ANSWER } from './grounding-prompt';
import { RagService } from './rag.service';
import {
  RetrievedChunk,
  RetrievalService,
} from './retrieval/retrieval.service';

const highSimilarityChunk: RetrievedChunk = {
  id: 'chunk-high',
  documentId: 'document-id',
  documentName: 'Manual técnico',
  productId: 'product-id',
  content: 'El botón físico silencia el micrófono.',
  chunkIndex: 0,
  pageStart: 14,
  pageEnd: 14,
  section: null,
  metadata: { ignored: true },
  similarity: 0.82,
};

describe('RagService', () => {
  const retrievalService: {
    retrieve: jest.MockedFunction<RetrievalService['retrieve']>;
  } = { retrieve: jest.fn() };
  const llmService: {
    generate: jest.MockedFunction<LlmService['generate']>;
  } = { generate: jest.fn() };
  const configService = {
    get: jest.fn((key: string, fallback: number) => {
      const values: Record<string, number> = {
        RAG_DEFAULT_TOP_K: 5,
        RAG_MIN_SIMILARITY: 0.5,
      };
      return values[key] ?? fallback;
    }),
  };
  const service = new RagService(
    retrievalService as unknown as RetrievalService,
    llmService as unknown as LlmService,
    configService as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    retrievalService.retrieve.mockResolvedValue([]);
    llmService.generate.mockResolvedValue({
      text: 'Sí, mediante el botón físico.',
      model: 'qwen3:8b',
    });
  });

  it('retrieves once, filters context, and maps only included sources', async () => {
    retrievalService.retrieve.mockResolvedValue([
      highSimilarityChunk,
      {
        ...highSimilarityChunk,
        id: 'chunk-low',
        content: 'Below threshold content',
        chunkIndex: 1,
        similarity: 0.49,
      },
    ]);

    await expect(
      service.answer({
        question: '  ¿Puedo silenciarlo?  ',
        productId: 'product-id',
        topK: 2,
      }),
    ).resolves.toEqual({
      answer: 'Sí, mediante el botón físico.',
      sources: [
        {
          chunkId: 'chunk-high',
          documentId: 'document-id',
          documentName: 'Manual técnico',
          productId: 'product-id',
          chunkIndex: 0,
          pageStart: 14,
          pageEnd: 14,
          section: null,
        },
      ],
    });
    expect(retrievalService.retrieve).toHaveBeenCalledTimes(1);
    expect(retrievalService.retrieve).toHaveBeenCalledWith(
      '¿Puedo silenciarlo?',
      { topK: 2, productId: 'product-id' },
    );
    expect(llmService.generate).toHaveBeenCalledTimes(1);
    expect(llmService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(highSimilarityChunk.content) as string,
      }),
    );
    const generateInput = llmService.generate.mock.calls[0]?.[0];
    expect(generateInput).toBeDefined();
    expect(generateInput?.prompt).not.toContain('Below threshold content');
  });

  it.each([
    ['no retrieval results', []],
    [
      'all chunks below the threshold',
      [{ ...highSimilarityChunk, similarity: 0.49 }],
    ],
  ])('returns deterministic insufficiency for %s', async (_, chunks) => {
    retrievalService.retrieve.mockResolvedValue(chunks);

    await expect(service.answer({ question: 'Unknown?' })).resolves.toEqual({
      answer: INSUFFICIENT_INFORMATION_ANSWER,
      sources: [],
    });
    expect(retrievalService.retrieve).toHaveBeenCalledWith('Unknown?', {
      topK: 5,
    });
    expect(llmService.generate).not.toHaveBeenCalled();
  });

  it.each([
    [{ question: '  ' }, 'Question must not be empty'],
    [{ question: 'Valid', topK: 0 }, 'topK must be a positive integer'],
    [{ question: 'Valid', topK: 1.5 }, 'topK must be a positive integer'],
  ])('rejects invalid input before retrieval', async (input, message) => {
    await expect(service.answer(input)).rejects.toThrow(message);
    expect(retrievalService.retrieve).not.toHaveBeenCalled();
  });

  it('propagates retrieval and generation failures', async () => {
    const retrievalError = new Error('retrieval failed');
    retrievalService.retrieve.mockRejectedValueOnce(retrievalError);
    await expect(service.answer({ question: 'Question' })).rejects.toBe(
      retrievalError,
    );

    const generationError = new Error('generation failed');
    retrievalService.retrieve.mockResolvedValueOnce([highSimilarityChunk]);
    llmService.generate.mockRejectedValueOnce(generationError);
    await expect(service.answer({ question: 'Question' })).rejects.toBe(
      generationError,
    );
  });
});
