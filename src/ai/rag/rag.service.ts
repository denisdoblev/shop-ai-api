import {
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LlmProviderError } from '../llm/llm-provider.error';
import { LlmService } from '../llm/llm.service';
import {
  buildGroundingPrompt,
  INSUFFICIENT_INFORMATION_ANSWER,
} from './grounding-prompt';
import { RagEvidenceService } from './rag-evidence.service';
import { RagContextChunk } from './retrieval/retrieval.service';

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
  constructor(
    private readonly evidenceService: RagEvidenceService,
    private readonly llmService: LlmService,
  ) {}

  async answer(input: RagQuestion): Promise<RagAnswer> {
    const question = input.question.trim();
    if (question.length === 0) throw new Error('Question must not be empty');
    const evidence = await this.evidenceService.retrieve({
      query: question,
      ...(input.productId === undefined ? {} : { productId: input.productId }),
      ...(input.topK === undefined ? {} : { topK: input.topK }),
    });
    if (evidence.status === 'insufficient_evidence')
      return { answer: INSUFFICIENT_INFORMATION_ANSWER, sources: [] };

    let output;
    try {
      output = await this.llmService.generate(
        buildGroundingPrompt(question, evidence.chunks),
      );
    } catch (error: unknown) {
      if (error instanceof LlmProviderError) {
        if (error.code === 'timeout')
          throw new GatewayTimeoutException('Generation provider timed out');
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
          : evidence.chunks.map((chunk) => this.toSource(chunk)),
    };
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
