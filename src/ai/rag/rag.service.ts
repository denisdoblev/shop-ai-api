import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isUUID } from 'class-validator';
import { LlmService } from '../llm/llm.service';
import {
  buildGroundingPrompt,
  INSUFFICIENT_INFORMATION_ANSWER,
} from './grounding-prompt';
import {
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
  ) {}

  async answer(input: RagQuestion): Promise<RagAnswer> {
    const question = input.question.trim();
    if (question.length === 0) {
      throw new Error('Question must not be empty');
    }

    if (input.productId !== undefined && !isUUID(input.productId)) {
      throw new TypeError('productId must be a valid UUID');
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
    const retrieved = await this.retrievalService.retrieve(question, {
      topK,
      ...(input.productId === undefined ? {} : { productId: input.productId }),
    });
    const retrievalDurationMs = Date.now() - retrievalStartedAt;
    const relevance = evaluateRelevance(retrieved, relevanceThresholds);
    const chunks = this.selectContextChunks(
      retrieved,
      relevance.reason,
      relevanceThresholds,
    );

    this.logger.debug({
      event: 'rag_retrieval_completed',
      retrievedChunks: retrieved.length,
      includedChunks: chunks.length,
      durationMs: retrievalDurationMs,
      top1Similarity: relevance.top1Similarity,
      top2Similarity: relevance.top2Similarity,
      similarityGap: relevance.similarityGap,
      reason: relevance.reason,
    });

    if (!relevance.shouldGenerate) {
      return { answer: INSUFFICIENT_INFORMATION_ANSWER, sources: [] };
    }

    const output = await this.llmService.generate(
      buildGroundingPrompt(question, chunks),
    );

    return {
      answer: output.text,
      sources: chunks.map((chunk) => this.toSource(chunk)),
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

  private toSource(chunk: RetrievedChunk): RagSource {
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
