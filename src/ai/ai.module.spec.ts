import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { AiModule } from './ai.module';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { LlmService } from './llm/llm.service';
import { ChunkingService } from './rag/chunking/chunking.service';
import { EmbeddingsService } from './rag/embeddings/embeddings.service';
import { RagChunk } from './rag/entities/rag-chunk.entity';
import { RagDocument } from './rag/entities/rag-document.entity';
import { IngestionService } from './rag/ingestion/ingestion.service';
import { RetrievalService } from './rag/retrieval/retrieval.service';
import { Product } from '../products/entities/product.entity';

describe('AiModule', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AiModule],
    })
      .overrideProvider(IngestionService)
      .useValue({})
      .overrideProvider(getRepositoryToken(Product))
      .useValue({})
      .overrideProvider(getRepositoryToken(RagDocument))
      .useValue({})
      .overrideProvider(getRepositoryToken(RagChunk))
      .useValue({})
      .compile();
  });

  afterAll(async () => {
    await module.close();
  });

  it('resolves the AI architecture and chat dependencies', () => {
    const retrievalService = module.get(RetrievalService);
    const llmService = module.get(LlmService);
    const chatService = module.get(ChatService);

    expect(module.get(ChatController)).toBeDefined();
    expect(module.get(IngestionService)).toBeDefined();
    expect(module.get(ChunkingService)).toBeDefined();
    expect(module.get(EmbeddingsService)).toBeDefined();
    expect(retrievalService).toBeDefined();
    expect(llmService).toBeDefined();
    expect(chatService).toHaveProperty('retrievalService', retrievalService);
    expect(chatService).toHaveProperty('llmService', llmService);
  });
});
