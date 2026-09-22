import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';
import { INSUFFICIENT_INFORMATION_ANSWER } from './grounding-prompt';
import { RagService } from './rag.service';
import {
  RetrievedChunk,
  RetrievalService,
} from './retrieval/retrieval.service';

const productId = '2f4bbf44-43f0-4a5b-bf1b-c7d92e04e4a8';

const highSimilarityChunk: RetrievedChunk = {
  id: 'chunk-high',
  documentId: 'document-id',
  documentName: 'Manual técnico',
  productId,
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
        RAG_STRONG_SIMILARITY_THRESHOLD: 0.5,
        RAG_MODERATE_SIMILARITY_THRESHOLD: 0.4,
        RAG_MINIMUM_SIMILARITY_GAP: 0.12,
      };
      return values[key] ?? fallback;
    }),
  };
  const service = new RagService(
    retrievalService as unknown as RetrievalService,
    llmService as unknown as LlmService,
    configService as unknown as ConfigService,
  );
  const loggerDebugSpy = jest
    .spyOn(Logger.prototype, 'debug')
    .mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    retrievalService.retrieve.mockResolvedValue([]);
    llmService.generate.mockResolvedValue({
      text: 'Sí, mediante el botón físico.',
      model: 'qwen3:8b',
    });
  });

  it('preserves strong-threshold context filtering and maps included sources', async () => {
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
        productId,
        topK: 2,
      }),
    ).resolves.toEqual({
      answer: 'Sí, mediante el botón físico.',
      sources: [
        {
          chunkId: 'chunk-high',
          documentId: 'document-id',
          documentName: 'Manual técnico',
          productId,
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
      { topK: 2, productId },
    );
    expect(loggerDebugSpy).toHaveBeenCalledWith({
      event: 'rag_retrieval_completed',
      retrievedChunks: 2,
      includedChunks: 1,
      durationMs: expect.any(Number) as number,
      top1Similarity: 0.82,
      top2Similarity: 0.49,
      similarityGap: 0.32999999999999996,
      reason: 'strong_similarity',
    });
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

  it('generates from only the dominant top chunk for moderate evidence with a strong gap', async () => {
    const moderateChunk = { ...highSimilarityChunk, similarity: 0.45 };
    const weakChunk = {
      ...highSimilarityChunk,
      id: 'chunk-weak',
      content: 'Weakly related content',
      similarity: 0.2,
    };
    retrievalService.retrieve.mockResolvedValue([moderateChunk, weakChunk]);

    await expect(
      service.answer({ question: 'Moderate evidence?' }),
    ).resolves.toMatchObject({
      answer: 'Sí, mediante el botón físico.',
      sources: [{ chunkId: moderateChunk.id }],
    });

    const generateInput = llmService.generate.mock.calls[0]?.[0];
    expect(generateInput?.prompt).toContain(moderateChunk.content);
    expect(generateInput?.prompt).not.toContain(weakChunk.content);
    expect(loggerDebugSpy).toHaveBeenCalledWith({
      event: 'rag_retrieval_completed',
      retrievedChunks: 2,
      includedChunks: 1,
      durationMs: expect.any(Number) as number,
      top1Similarity: 0.45,
      top2Similarity: 0.2,
      similarityGap: 0.25,
      reason: 'moderate_similarity_with_gap',
    });
  });

  it.each([
    ['no retrieval results', [], null, null, null],
    [
      'a single moderate result without an observable gap',
      [{ ...highSimilarityChunk, similarity: 0.49 }],
      0.49,
      null,
      null,
    ],
    [
      'moderate results with a weak gap',
      [
        { ...highSimilarityChunk, similarity: 0.43 },
        { ...highSimilarityChunk, id: 'chunk-second', similarity: 0.4 },
      ],
      0.43,
      0.4,
      0.02999999999999997,
    ],
    [
      'scores below the moderate threshold',
      [
        { ...highSimilarityChunk, similarity: 0.25 },
        { ...highSimilarityChunk, id: 'chunk-second', similarity: 0.2 },
      ],
      0.25,
      0.2,
      0.04999999999999999,
    ],
  ])(
    'returns deterministic insufficiency for %s',
    async (_, chunks, top1Similarity, top2Similarity, similarityGap) => {
      retrievalService.retrieve.mockResolvedValue(chunks);

      await expect(service.answer({ question: 'Unknown?' })).resolves.toEqual({
        answer: INSUFFICIENT_INFORMATION_ANSWER,
        sources: [],
      });
      expect(retrievalService.retrieve).toHaveBeenCalledWith('Unknown?', {
        topK: 5,
      });
      expect(loggerDebugSpy).toHaveBeenCalledWith({
        event: 'rag_retrieval_completed',
        retrievedChunks: chunks.length,
        includedChunks: 0,
        durationMs: expect.any(Number) as number,
        top1Similarity,
        top2Similarity,
        similarityGap,
        reason: 'insufficient_relevance',
      });
      expect(llmService.generate).not.toHaveBeenCalled();
    },
  );

  it('passes a valid productId to retrieval', async () => {
    await service.answer({ question: 'Question', productId });

    expect(retrievalService.retrieve).toHaveBeenCalledWith('Question', {
      topK: 5,
      productId,
    });
  });

  it('rejects an invalid productId before invoking collaborators', async () => {
    await expect(
      service.answer({ question: 'Question', productId: 'not-a-uuid' }),
    ).rejects.toEqual(new TypeError('productId must be a valid UUID'));
    expect(retrievalService.retrieve).not.toHaveBeenCalled();
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
