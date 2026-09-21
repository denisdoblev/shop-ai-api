import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';
import {
  buildGroundingPrompt,
  INSUFFICIENT_INFORMATION_ANSWER,
} from './grounding-prompt';
import {
  RetrievedChunk,
  RetrievalService,
} from './retrieval/retrieval.service';

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

    const topK =
      input.topK ?? this.configService.get<number>('RAG_DEFAULT_TOP_K', 5);
    if (!Number.isInteger(topK) || topK <= 0) {
      throw new RangeError('topK must be a positive integer');
    }

    const minimumSimilarity = this.configService.get<number>(
      'RAG_MIN_SIMILARITY',
      0.5,
    );
    const retrieved = await this.retrievalService.retrieve(question, {
      topK,
      ...(input.productId === undefined ? {} : { productId: input.productId }),
    });
    const chunks = retrieved.filter(
      ({ similarity }) => similarity >= minimumSimilarity,
    );

    this.logger.debug({
      event: 'rag_retrieval_completed',
      retrievedChunks: retrieved.length,
      includedChunks: chunks.length,
    });

    if (chunks.length === 0) {
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
