import {
  GatewayTimeoutException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { LlmProviderError } from '../llm/llm-provider.error';
import { LlmService } from '../llm/llm.service';
import { EmbeddingProviderError } from './embeddings/embedding-provider.error';
import { INSUFFICIENT_INFORMATION_ANSWER } from './grounding-prompt';
import { RagService } from './rag.service';
import { RagEvidenceService } from './rag-evidence.service';
import {
  LexicalRetrievedChunk,
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

const lexicalChunk: LexicalRetrievedChunk = {
  id: 'chunk-lexical',
  documentId: 'document-id',
  documentName: 'Especificaciones de AirPods',
  productId,
  content: 'Tecnología inalámbrica Bluetooth 5.3.',
  chunkIndex: 3,
  pageStart: null,
  pageEnd: null,
  section: 'Conectividad',
  metadata: {},
  lexicalScore: 0.7,
};

describe('RagService', () => {
  const retrievalService: {
    findBestLexicalMatch: jest.MockedFunction<
      RetrievalService['findBestLexicalMatch']
    >;
    retrieve: jest.MockedFunction<RetrievalService['retrieve']>;
  } = { findBestLexicalMatch: jest.fn(), retrieve: jest.fn() };
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
  const productRepository = {
    findOneBy: jest.fn(),
  };
  const evidenceService = new RagEvidenceService(
    retrievalService as unknown as RetrievalService,
    configService as unknown as ConfigService,
    productRepository as unknown as Repository<Product>,
  );
  const service = new RagService(
    evidenceService,
    llmService as unknown as LlmService,
  );
  const loggerDebugSpy = jest
    .spyOn(Logger.prototype, 'debug')
    .mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    retrievalService.findBestLexicalMatch.mockResolvedValue(null);
    retrievalService.retrieve.mockResolvedValue([]);
    llmService.generate.mockResolvedValue({
      text: 'Sí, mediante el botón físico.',
      model: 'qwen3:8b',
    });
    productRepository.findOneBy.mockResolvedValue({
      id: productId,
      name: 'Auricular Conference Pro',
    });
  });

  it('uses one lexical match and skips vector retrieval and embeddings', async () => {
    retrievalService.findBestLexicalMatch.mockResolvedValue(lexicalChunk);
    retrievalService.retrieve.mockRejectedValue(
      new EmbeddingProviderError('unavailable', 'Ollama is unavailable'),
    );

    await expect(
      service.answer({ question: '  ¿Tiene Bluetooth?  ', productId }),
    ).resolves.toEqual({
      answer: 'Sí, mediante el botón físico.',
      sources: [
        {
          chunkId: lexicalChunk.id,
          documentId: lexicalChunk.documentId,
          documentName: lexicalChunk.documentName,
          productId,
          chunkIndex: lexicalChunk.chunkIndex,
          pageStart: null,
          pageEnd: null,
          section: lexicalChunk.section,
        },
      ],
    });
    expect(retrievalService.findBestLexicalMatch).toHaveBeenCalledWith(
      '¿Tiene Bluetooth?',
      { productId },
    );
    expect(retrievalService.retrieve).not.toHaveBeenCalled();
    expect(llmService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(lexicalChunk.content) as string,
      }),
    );
    const generateInput = llmService.generate.mock.calls[0]?.[0];
    expect(generateInput?.prompt).toContain('QUESTION\n¿Tiene Bluetooth?');
    expect(loggerDebugSpy).toHaveBeenCalledWith({
      event: 'rag_retrieval_completed',
      retrievalMode: 'lexical',
      retrievedChunks: 1,
      includedChunks: 1,
      lexicalMatches: 1,
      durationMs: expect.any(Number) as number,
      lexicalScore: 0.7,
      top1Similarity: null,
      top2Similarity: null,
      similarityGap: null,
      reason: 'lexical_match',
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
      `Producto seleccionado: Auricular Conference Pro
Pregunta del usuario: ¿Puedo silenciarlo?`,
      { topK: 2, productId },
    );
    expect(loggerDebugSpy).toHaveBeenCalledWith({
      event: 'rag_retrieval_completed',
      retrievalMode: 'vector',
      retrievedChunks: 2,
      includedChunks: 1,
      lexicalMatches: 0,
      durationMs: expect.any(Number) as number,
      lexicalScore: null,
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
    expect(generateInput?.prompt).toContain('QUESTION\n¿Puedo silenciarlo?');
    expect(generateInput?.prompt).not.toContain('Producto seleccionado:');
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
      retrievalMode: 'vector',
      retrievedChunks: 2,
      includedChunks: 1,
      lexicalMatches: 0,
      durationMs: expect.any(Number) as number,
      lexicalScore: null,
      top1Similarity: 0.45,
      top2Similarity: 0.2,
      similarityGap: 0.25,
      reason: 'moderate_similarity_with_gap',
    });
  });

  it('returns no sources when generation produces the canonical insufficiency answer', async () => {
    retrievalService.retrieve.mockResolvedValue([highSimilarityChunk]);
    llmService.generate.mockResolvedValue({
      text: INSUFFICIENT_INFORMATION_ANSWER,
      model: 'qwen3:8b',
    });

    await expect(
      service.answer({ question: 'Unsupported detail?', productId }),
    ).resolves.toEqual({
      answer: INSUFFICIENT_INFORMATION_ANSWER,
      sources: [],
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
        retrievalMode: 'vector',
        retrievedChunks: chunks.length,
        includedChunks: 0,
        lexicalMatches: 0,
        durationMs: expect.any(Number) as number,
        lexicalScore: null,
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

    expect(productRepository.findOneBy).toHaveBeenCalledWith({ id: productId });
    expect(retrievalService.retrieve).toHaveBeenCalledWith(
      `Producto seleccionado: Auricular Conference Pro
Pregunta del usuario: Question`,
      { topK: 5, productId },
    );
  });

  it('rejects an absent or soft-deleted product before retrieval', async () => {
    productRepository.findOneBy.mockResolvedValue(null);

    await expect(
      service.answer({ question: 'Question', productId }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(retrievalService.retrieve).not.toHaveBeenCalled();
    expect(llmService.generate).not.toHaveBeenCalled();
  });

  it('preserves product-agnostic internal retrieval', async () => {
    await service.answer({ question: 'Question' });

    expect(productRepository.findOneBy).not.toHaveBeenCalled();
    expect(retrievalService.retrieve).toHaveBeenCalledWith('Question', {
      topK: 5,
    });
  });

  it('rejects an invalid productId before invoking collaborators', async () => {
    await expect(
      service.answer({ question: 'Question', productId: 'not-a-uuid' }),
    ).rejects.toEqual(new TypeError('productId must be a valid UUID'));
    expect(productRepository.findOneBy).not.toHaveBeenCalled();
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

  it.each([
    'timeout',
    'unavailable',
    'upstream_error',
    'invalid_response',
  ] as const)(
    'maps embedding provider %s failures to service unavailable',
    async (code) => {
      retrievalService.retrieve.mockRejectedValue(
        new EmbeddingProviderError(code, 'embedding failed'),
      );

      await expect(
        service.answer({ question: 'Question' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(llmService.generate).not.toHaveBeenCalled();
    },
  );

  it('maps an LLM timeout to gateway timeout', async () => {
    retrievalService.retrieve.mockResolvedValue([highSimilarityChunk]);
    llmService.generate.mockRejectedValue(
      new LlmProviderError('timeout', 'timed out'),
    );

    await expect(
      service.answer({ question: 'Question' }),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);
  });

  it.each(['unavailable', 'upstream_error', 'invalid_response'] as const)(
    'maps LLM provider %s failures to service unavailable',
    async (code) => {
      retrievalService.retrieve.mockResolvedValue([highSimilarityChunk]);
      llmService.generate.mockRejectedValue(
        new LlmProviderError(code, 'generation failed'),
      );

      await expect(
        service.answer({ question: 'Question' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    },
  );

  it('propagates unexpected retrieval and generation failures', async () => {
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
