import { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EmbeddingsService } from '../src/ai/rag/embeddings/embeddings.service';
import { RagDocumentSourceType } from '../src/ai/rag/entities/rag-document-source-type.enum';
import { RagDocumentStatus } from '../src/ai/rag/entities/rag-document-status.enum';
import { RagChunk } from '../src/ai/rag/entities/rag-chunk.entity';
import { RagDocument } from '../src/ai/rag/entities/rag-document.entity';
import { INSUFFICIENT_INFORMATION_ANSWER } from '../src/ai/rag/grounding-prompt';
import { RagService } from '../src/ai/rag/rag.service';
import { Brand } from '../src/brands/entities/brand.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Product } from '../src/products/entities/product.entity';
import { clearDatabase, closeTestApp, initTestApp } from './test-utils';

const chunks = [
  {
    content:
      'Este auricular tiene un botón físico dedicado para silenciar y reactivar el micrófono durante una llamada.',
    pageStart: 14,
    pageEnd: 14,
    section: 'Controles de llamada',
  },
  {
    content:
      'El headset incluye cancelación activa de ruido para llamadas y música.',
    pageStart: 8,
    pageEnd: 8,
    section: 'Audio',
  },
  {
    content: 'La batería ofrece una autonomía de hasta 38 horas.',
    pageStart: 21,
    pageEnd: 21,
    section: 'Batería',
  },
];

describe('RAG generation integration', () => {
  jest.setTimeout(180_000);

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

  it('generates a grounded answer and returns the exact source page', async () => {
    const { product, document, persistedChunks } = await createFixture(app);

    const result = await app.get(RagService).answer({
      question: '¿Puedo silenciar el micrófono usando un botón físico?',
      productId: product.id,
      topK: 3,
    });

    expect(result.answer).not.toHaveLength(0);
    expect(result.answer.toLowerCase()).toMatch(
      /micrófono|microfono|silenci|botón|boton/,
    );
    expect(result.sources).toContainEqual({
      chunkId: persistedChunks[0]?.id,
      documentId: document.id,
      documentName: document.name,
      productId: product.id,
      chunkIndex: 0,
      pageStart: 14,
      pageEnd: 14,
      section: 'Controles de llamada',
    });
  });

  it('refuses a comparison unsupported by the available sources', async () => {
    const { product } = await createFixture(app);

    const result = await app.get(RagService).answer({
      question: '¿Es este auricular mejor que los AirPods Pro?',
      productId: product.id,
      topK: 3,
    });

    expect(result.answer).toContain(INSUFFICIENT_INFORMATION_ANSWER);
    expect(result.answer.toLowerCase()).not.toMatch(
      /(?:este auricular|airpods pro) es mejor/,
    );
  });
});

async function createFixture(app: INestApplication): Promise<{
  product: Product;
  document: RagDocument;
  persistedChunks: RagChunk[];
}> {
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
    name: 'Manual técnico',
    sourceType: RagDocumentSourceType.TEXT,
    sourceUri: null,
    mimeType: 'text/plain',
    contentHash: createHash('sha256')
      .update(chunks.map(({ content }) => content).join('\n'))
      .digest('hex'),
    status: RagDocumentStatus.READY,
    processedAt: new Date(),
    metadata: { fixture: true },
  });

  const embeddings = await app
    .get(EmbeddingsService)
    .embedDocuments(
      chunks.map(({ content }) => ({ content, title: document.name })),
    );
  const persistedChunks = await dataSource.getRepository(RagChunk).save(
    chunks.map((chunk, chunkIndex) => {
      const embedding = embeddings[chunkIndex];
      if (embedding === undefined) {
        throw new Error('Ollama did not return every fixture embedding');
      }

      return {
        documentId: document.id,
        ...chunk,
        chunkIndex,
        metadata: { fixture: true },
        embedding: embedding.values,
        embeddingModel: embedding.model,
        embeddedAt: new Date(),
      };
    }),
  );

  return { product, document, persistedChunks };
}
