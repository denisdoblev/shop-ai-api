import { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EmbeddingsService } from '../src/ai/rag/embeddings/embeddings.service';
import { RagDocumentSourceType } from '../src/ai/rag/entities/rag-document-source-type.enum';
import { RagDocumentStatus } from '../src/ai/rag/entities/rag-document-status.enum';
import { RagChunk } from '../src/ai/rag/entities/rag-chunk.entity';
import { RagDocument } from '../src/ai/rag/entities/rag-document.entity';
import { RetrievalService } from '../src/ai/rag/retrieval/retrieval.service';
import { Brand } from '../src/brands/entities/brand.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Product } from '../src/products/entities/product.entity';
import { clearDatabase, closeTestApp, initTestApp } from './test-utils';

const chunks = [
  'Este auricular tiene un botón físico para silenciar el micrófono.',
  'El headset incluye cancelación activa de ruido para llamadas y música.',
  'La batería ofrece una autonomía de hasta 38 horas.',
];

describe('RAG retrieval integration', () => {
  jest.setTimeout(60_000);

  let app: INestApplication;

  beforeAll(async () => {
    app = await initTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('ranks the physical microphone mute control above unrelated chunks', async () => {
    const dataSource = app.get(DataSource);
    const brand = await dataSource.getRepository(Brand).save({
      name: 'Test Audio',
      slug: 'test-audio',
    });
    const category = await dataSource.getRepository(Category).save({
      name: 'Headsets',
      slug: 'headsets',
    });
    const product = await dataSource.getRepository(Product).save({
      brandId: brand.id,
      categoryId: category.id,
      name: 'Conference Headset',
      slug: 'conference-headset',
    });
    const document = await dataSource.getRepository(RagDocument).save({
      productId: product.id,
      name: 'Manual del producto',
      sourceType: RagDocumentSourceType.TEXT,
      sourceUri: null,
      mimeType: 'text/plain',
      contentHash: createHash('sha256').update(chunks.join('\n')).digest('hex'),
      status: RagDocumentStatus.READY,
      processedAt: new Date(),
      metadata: { fixture: true },
    });

    const embeddingsService = app.get(EmbeddingsService);
    const embeddings = await embeddingsService.embedDocuments(
      chunks.map((content) => ({ content, title: document.name })),
    );
    await dataSource.getRepository(RagChunk).save(
      chunks.map((content, chunkIndex) => {
        const embedding = embeddings[chunkIndex];
        if (embedding === undefined) {
          throw new Error('Ollama did not return every fixture embedding');
        }

        return {
          documentId: document.id,
          content,
          chunkIndex,
          metadata: { label: String.fromCharCode(65 + chunkIndex) },
          embedding: embedding.values,
          embeddingModel: embedding.model,
          embeddedAt: new Date(),
        };
      }),
    );

    const results = await app
      .get(RetrievalService)
      .retrieve('¿Puedo mutear el micrófono usando un botón físico?', {
        topK: 3,
        productId: product.id,
      });

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      documentId: document.id,
      productId: product.id,
      content: chunks[0],
      chunkIndex: 0,
    });
    expect(results[0]?.similarity).toBeGreaterThan(
      results[1]?.similarity ?? Number.NEGATIVE_INFINITY,
    );
    expect(results[0]?.similarity).toBeGreaterThan(
      results[2]?.similarity ?? Number.NEGATIVE_INFINITY,
    );
  });
});
