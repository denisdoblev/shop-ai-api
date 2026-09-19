import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { RetrievalService } from '../rag/retrieval/retrieval.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly retrievalService: RetrievalService,
    private readonly llmService: LlmService,
  ) {}
}
