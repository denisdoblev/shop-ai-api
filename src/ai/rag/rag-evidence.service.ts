import {
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
import { EmbeddingProviderError } from './embeddings/embedding-provider.error';
import {
  RagContextChunk,
  RetrievedChunk,
  RetrievalService,
} from './retrieval/retrieval.service';
import { evaluateRelevance, RelevanceThresholds } from './relevance-gate';

export interface RagEvidenceInput {
  query: string;
  productId?: string;
  topK?: number;
}
export interface RagEvidenceResult {
  status: 'evidence_found' | 'insufficient_evidence';
  chunks: RagContextChunk[];
}

@Injectable()
export class RagEvidenceService {
  private readonly logger = new Logger(RagEvidenceService.name);

  constructor(
    private readonly retrievalService: RetrievalService,
    private readonly configService: ConfigService,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async retrieve(input: RagEvidenceInput): Promise<RagEvidenceResult> {
    const query = input.query.trim();
    if (query.length === 0) throw new Error('Query must not be empty');
    if (input.productId !== undefined && !isUUID(input.productId))
      throw new TypeError('productId must be a valid UUID');

    const product =
      input.productId === undefined
        ? null
        : await this.productRepository.findOneBy({ id: input.productId });
    if (input.productId !== undefined && product === null)
      throw new NotFoundException(
        `Product with id ${input.productId} not found`,
      );

    const topK =
      input.topK ?? this.configService.get<number>('RAG_DEFAULT_TOP_K', 5);
    if (!Number.isInteger(topK) || topK <= 0)
      throw new RangeError('topK must be a positive integer');
    const thresholds: RelevanceThresholds = {
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
    const startedAt = Date.now();
    const options =
      input.productId === undefined ? {} : { productId: input.productId };
    const lexicalMatch = await this.retrievalService.findBestLexicalMatch(
      query,
      options,
    );
    if (lexicalMatch !== null) {
      const chunks = [lexicalMatch];
      this.logCompleted('lexical', 1, chunks, Date.now() - startedAt, {
        lexicalScore: lexicalMatch.lexicalScore,
        top1Similarity: null,
        top2Similarity: null,
        similarityGap: null,
        reason: 'lexical_match',
      });
      return { status: 'evidence_found', chunks };
    }

    let retrieved: RetrievedChunk[];
    try {
      const vectorQuery =
        product === null
          ? query
          : `Producto seleccionado: ${product.name}\nPregunta del usuario: ${query}`;
      retrieved = await this.retrievalService.retrieve(vectorQuery, {
        topK,
        ...options,
      });
    } catch (error: unknown) {
      if (error instanceof EmbeddingProviderError)
        throw new ServiceUnavailableException(
          'Embedding provider is unavailable',
        );
      throw error;
    }
    const relevance = evaluateRelevance(retrieved, thresholds);
    const chunks =
      relevance.reason === 'strong_similarity'
        ? retrieved.filter(
            ({ similarity }) =>
              similarity >= thresholds.strongSimilarityThreshold,
          )
        : relevance.reason === 'moderate_similarity_with_gap'
          ? retrieved.slice(0, 1)
          : [];
    this.logCompleted(
      'vector',
      retrieved.length,
      chunks,
      Date.now() - startedAt,
      {
        lexicalScore: null,
        top1Similarity: relevance.top1Similarity,
        top2Similarity: relevance.top2Similarity,
        similarityGap: relevance.similarityGap,
        reason: relevance.reason,
      },
    );
    return relevance.shouldGenerate
      ? { status: 'evidence_found', chunks }
      : { status: 'insufficient_evidence', chunks: [] };
  }

  private logCompleted(
    mode: 'lexical' | 'vector',
    retrievedChunks: number,
    chunks: RagContextChunk[],
    durationMs: number,
    details: Record<string, unknown>,
  ): void {
    this.logger.debug({
      event: 'rag_retrieval_completed',
      retrievalMode: mode,
      retrievedChunks,
      includedChunks: chunks.length,
      lexicalMatches: mode === 'lexical' ? retrievedChunks : 0,
      durationMs,
      ...details,
    });
  }
}
