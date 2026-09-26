import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai.module';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { LlmService } from './llm/llm.service';
import { ChunkingService } from './rag/chunking/chunking.service';
import { EmbeddingsService } from './rag/embeddings/embeddings.service';
import { RagChunk } from './rag/entities/rag-chunk.entity';
import { RagDocument } from './rag/entities/rag-document.entity';
import { IngestionService } from './rag/ingestion/ingestion.service';
import { RagService } from './rag/rag.service';
import { RetrievalService } from './rag/retrieval/retrieval.service';
import { Product } from '../products/entities/product.entity';
import { ProductImage } from '../products/entities/product-image.entity';
import { ProductPrice } from '../products/entities/product-price.entity';
import { ProductSpecification } from '../products/entities/product-specification.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Category } from '../categories/entities/category.entity';
import { Attribute } from '../attributes/entities/attribute.entity';
import { ProductSearchService } from '../products/product-search.service';
import { RagEvidenceService } from './rag/rag-evidence.service';

describe('AiModule', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ limit: 5, ttl: 60_000 }]), AiModule],
    })
      .overrideProvider(IngestionService)
      .useValue({})
      .overrideProvider(ProductSearchService)
      .useValue({})
      .overrideProvider(getRepositoryToken(Product))
      .useValue({})
      .overrideProvider(getRepositoryToken(ProductImage))
      .useValue({})
      .overrideProvider(getRepositoryToken(ProductPrice))
      .useValue({})
      .overrideProvider(getRepositoryToken(ProductSpecification))
      .useValue({})
      .overrideProvider(getRepositoryToken(Brand))
      .useValue({})
      .overrideProvider(getRepositoryToken(Category))
      .useValue({})
      .overrideProvider(getRepositoryToken(Attribute))
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
    const ragService = module.get(RagService);
    const evidenceService = module.get(RagEvidenceService);
    const chatService = module.get(ChatService);

    expect(module.get(ChatController)).toBeDefined();
    expect(module.get(IngestionService)).toBeDefined();
    expect(module.get(ChunkingService)).toBeDefined();
    expect(module.get(EmbeddingsService)).toBeDefined();
    expect(retrievalService).toBeDefined();
    expect(llmService).toBeDefined();
    expect(evidenceService).toHaveProperty(
      'retrievalService',
      retrievalService,
    );
    expect(ragService).toHaveProperty('evidenceService', evidenceService);
    expect(ragService).toHaveProperty('llmService', llmService);
    expect(chatService).toHaveProperty('llmService', llmService);
  });
});
