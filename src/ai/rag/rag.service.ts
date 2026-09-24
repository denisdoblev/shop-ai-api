import {
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { LlmProviderError } from '../llm/llm-provider.error';
import { LlmService } from '../llm/llm.service';
import { EmbeddingProviderError } from './embeddings/embedding-provider.error';
import {
  buildGroundingPrompt,
  INSUFFICIENT_INFORMATION_ANSWER,
} from './grounding-prompt';
import {
  RagContextChunk,
  RetrievedChunk,
  RetrievalService,
} from './retrieval/retrieval.service';
import { evaluateRelevance, RelevanceThresholds } from './relevance-gate';

export interface RagQuestion {
  question: string;
  productId?: string;
  topK?: number;
}

export interface RagSource {
  chunkId: string;
  documentId: string;
  documentName: string;
  productId: string;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  section: string | null;
}

export interface RagAnswer {
  answer: string;
  sources: RagSource[];
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly retrievalService: RetrievalService,
    private readonly llmService: LlmService,
    private readonly configService: ConfigService,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async answer(input: RagQuestion): Promise<RagAnswer> {
    const question = input.question.trim();
    if (question.length === 0) {
      throw new Error('Question must not be empty');
    }

    if (input.productId !== undefined && !isUUID(input.productId)) {
      throw new TypeError('productId must be a valid UUID');
    }

    let product: Product | null = null;
    if (input.productId !== undefined) {
      product = await this.productRepository.findOneBy({ id: input.productId });
      if (product === null) {
        throw new NotFoundException(
          `Product with id ${input.productId} not found`,
        );
      }
    }

    const topK =
      input.topK ?? this.configService.get<number>('RAG_DEFAULT_TOP_K', 5);
    if (!Number.isInteger(topK) || topK <= 0) {
      throw new RangeError('topK must be a positive integer');
    }

    const relevanceThresholds: RelevanceThresholds = {
      strongSimilarityThreshold: this.configService.get<number>(
        'RAG_STRONG_SIMILARITY_THRESHOLD',
        0.5,
      ),
      moderateSimilarityThreshold: this.configService.get<number>(
        'RAG_MODERATE_SIMILARITY_THRESHOLD',
        0.4,
      ),
      minimumSimilarityGap: this.configService.get<number>(
        'RAG_MINIMUM_SIMILARITY_GAP',
        0.12,
      ),
    };
    const retrievalStartedAt = Date.now();
    const retrievalOptions =
      input.productId === undefined ? {} : { productId: input.productId };
    const lexicalMatch = await this.retrievalService.findBestLexicalMatch(
      question,
      retrievalOptions,
    );
    if (lexicalMatch !== null) {
      const chunks = [lexicalMatch];
      this.logRetrievalCompleted({
        mode: 'lexical',
        retrievedChunks: 1,
        chunks,
        durationMs: Date.now() - retrievalStartedAt,
        lexicalScore: lexicalMatch.lexicalScore,
        top1Similarity: null,
        top2Similarity: null,
        similarityGap: null,
        reason: 'lexical_match',
      });
      return this.generateAnswer(question, chunks);
    }

    let retrieved: RetrievedChunk[];
    try {
      const vectorQuery =
        product === null
          ? question
          : `Producto seleccionado: ${product.name}\nPregunta del usuario: ${question}`;
      retrieved = await this.retrievalService.retrieve(vectorQuery, {
        topK,
        ...retrievalOptions,
      });
    } catch (error: unknown) {
      if (error instanceof EmbeddingProviderError) {
        throw new ServiceUnavailableException(
          'Embedding provider is unavailable',
        );
      }
      throw error;
    }

    const retrievalDurationMs = Date.now() - retrievalStartedAt;
    const relevance = evaluateRelevance(retrieved, relevanceThresholds);
    const chunks = this.selectContextChunks(
      retrieved,
      relevance.reason,
      relevanceThresholds,
    );

    this.logRetrievalCompleted({
      mode: 'vector',
      retrievedChunks: retrieved.length,
      chunks,
      durationMs: retrievalDurationMs,
      lexicalScore: null,
      top1Similarity: relevance.top1Similarity,
      top2Similarity: relevance.top2Similarity,
      similarityGap: relevance.similarityGap,
      reason: relevance.reason,
    });

    if (!relevance.shouldGenerate) {
      return { answer: INSUFFICIENT_INFORMATION_ANSWER, sources: [] };
    }

    return this.generateAnswer(question, chunks);
  }

  private async generateAnswer(
    question: string,
    chunks: RagContextChunk[],
  ): Promise<RagAnswer> {
    let output;
    try {
      output = await this.llmService.generate(
        buildGroundingPrompt(question, chunks),
      );
    } catch (error: unknown) {
      if (error instanceof LlmProviderError) {
        if (error.code === 'timeout') {
          throw new GatewayTimeoutException('Generation provider timed out');
        }
        throw new ServiceUnavailableException(
          'Generation provider is unavailable',
        );
      }
      throw error;
    }

    return {
      answer: output.text,
      sources:
        output.text === INSUFFICIENT_INFORMATION_ANSWER
          ? []
          : chunks.map((chunk) => this.toSource(chunk)),
    };
  }

  private selectContextChunks(
    retrieved: RetrievedChunk[],
    reason: ReturnType<typeof evaluateRelevance>['reason'],
    thresholds: RelevanceThresholds,
  ): RetrievedChunk[] {
    if (reason === 'strong_similarity') {
      return retrieved.filter(
        ({ similarity }) => similarity >= thresholds.strongSimilarityThreshold,
      );
    }
    if (reason === 'moderate_similarity_with_gap') {
      return retrieved.slice(0, 1);
    }
    return [];
  }

  private logRetrievalCompleted(input: {
    mode: 'lexical' | 'vector';
    retrievedChunks: number;
    chunks: RagContextChunk[];
    durationMs: number;
    lexicalScore: number | null;
    top1Similarity: number | null;
    top2Similarity: number | null;
    similarityGap: number | null;
    reason:
      | 'lexical_match'
      | 'strong_similarity'
      | 'moderate_similarity_with_gap'
      | 'insufficient_relevance';
  }): void {
    this.logger.debug({
      event: 'rag_retrieval_completed',
      retrievalMode: input.mode,
      retrievedChunks: input.retrievedChunks,
      includedChunks: input.chunks.length,
      lexicalMatches: input.mode === 'lexical' ? input.retrievedChunks : 0,
      durationMs: input.durationMs,
      lexicalScore: input.lexicalScore,
      top1Similarity: input.top1Similarity,
      top2Similarity: input.top2Similarity,
      similarityGap: input.similarityGap,
      reason: input.reason,
    });
  }

  private toSource(chunk: RagContextChunk): RagSource {
    return {
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      productId: chunk.productId,
      chunkIndex: chunk.chunkIndex,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      section: chunk.section,
    };
  }
}
