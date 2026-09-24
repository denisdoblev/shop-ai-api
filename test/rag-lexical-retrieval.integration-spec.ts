import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { LlmService } from '../src/ai/llm/llm.service';
import { EmbeddingProviderError } from '../src/ai/rag/embeddings/embedding-provider.error';
import { EmbeddingsService } from '../src/ai/rag/embeddings/embeddings.service';
import { RagDocumentSourceType } from '../src/ai/rag/entities/rag-document-source-type.enum';
import { RagDocumentStatus } from '../src/ai/rag/entities/rag-document-status.enum';
import { RagChunk } from '../src/ai/rag/entities/rag-chunk.entity';
import { RagDocument } from '../src/ai/rag/entities/rag-document.entity';
import { RagService } from '../src/ai/rag/rag.service';
import { RetrievalService } from '../src/ai/rag/retrieval/retrieval.service';
import { Brand } from '../src/brands/entities/brand.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Product } from '../src/products/entities/product.entity';
import { clearDatabase, closeTestApp, initTestApp } from './test-utils';

const AIRPODS_CONTENT =
  'Los AirPods Pro 2 incorporan el chip H2, cancelación activa de ruido, audio adaptativo, modo de sonido ambiente y detección de conversación. Los auriculares y el estuche de carga son resistentes al polvo, al agua y al sudor. Ofrecen hasta 6 horas de reproducción de audio con una sola carga y hasta 30 horas con el estuche. Peso: 384,8 g. La conectividad utiliza tecnología inalámbrica Bluetooth 5.3. Se pueden usar con dispositivos Apple actualizados y como auriculares Bluetooth con otros dispositivos, aunque algunas funciones pueden estar limitadas.';

describe('RAG strict lexical retrieval integration', () => {
  jest.setTimeout(60_000);

  const embedQuery = jest.fn();
  const generate = jest.fn();
  let app: INestApplication;

  beforeAll(async () => {
    app = await initTestApp((builder) =>
      builder
        .overrideProvider(EmbeddingsService)
        .useValue({ embedQuery })
        .overrideProvider(LlmService)
        .useValue({ generate }),
    );
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    embedQuery.mockRejectedValue(
      new EmbeddingProviderError('unavailable', 'Ollama is unavailable'),
    );
    generate.mockResolvedValue({
      text: 'Sí. Las especificaciones indican Bluetooth 5.3.',
      model: 'test-llm',
    });
    await clearDatabase();
  });

  it('answers from one product-scoped lexical chunk without invoking embeddings', async () => {
    const { product, chunk } = await createAirPodsFixture(app);

    const result = await app.get(RagService).answer({
      question: '¿Tiene Bluetooth?',
      productId: product.id,
    });

    expect(result.answer).toContain('Bluetooth');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.chunkId).toBe(chunk.id);
    expect(result.sources[0]?.productId).toBe(product.id);
    expect(embedQuery).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('finds weight evidence after removing the interrogative term', async () => {
    const { product, chunk } = await createAirPodsFixture(app);
    const retrievalService = app.get(RetrievalService);

    const match = await retrievalService.findBestLexicalMatch(
      '¿Cuánto pesan?',
      { productId: product.id },
    );

    expect(match?.id).toBe(chunk.id);
    expect(match?.content).toContain('Peso: 384,8 g');
    expect(embedQuery).not.toHaveBeenCalled();
  });

  it('requires every significant term in the same chunk', async () => {
    const { product } = await createAirPodsFixture(app);
    const retrievalService = app.get(RetrievalService);

    await expect(
      retrievalService.findBestLexicalMatch('¿Qué alcance tiene Bluetooth?', {
        productId: product.id,
      }),
    ).resolves.toBeNull();
    await expect(
      retrievalService.findBestLexicalMatch('¿Qué códecs Bluetooth admite?', {
        productId: product.id,
      }),
    ).resolves.toBeNull();
  });

  it('does not let user-provided operators relax strict matching', async () => {
    const { product } = await createAirPodsFixture(app);
    const retrievalService = app.get(RetrievalService);

    await expect(
      retrievalService.findBestLexicalMatch('"alcance" OR Bluetooth', {
        productId: product.id,
      }),
    ).resolves.toBeNull();
  });

  it('keeps the embedding 503 when no strict lexical match exists', async () => {
    const { product } = await createAirPodsFixture(app);

    await expect(
      app.get(RagService).answer({
        question: '¿Qué alcance tiene Bluetooth?',
        productId: product.id,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(embedQuery).toHaveBeenCalledTimes(1);
    expect(generate).not.toHaveBeenCalled();
  });

  it('uses score, shorter content, then id ordering', async () => {
    const dataSource = app.get(DataSource);
    const { product, document } = await createAirPodsFixture(app);
    const chunks = dataSource.getRepository(RagChunk);
    await chunks.delete({ documentId: document.id });

    const first = await chunks.save({
      id: '00000000-0000-4000-8000-000000000001',
      documentId: document.id,
      content: 'Bluetooth disponible.',
      chunkIndex: 0,
      section: 'Conectividad',
      metadata: {},
    });
    await chunks.save({
      id: '00000000-0000-4000-8000-000000000002',
      documentId: document.id,
      content: 'Bluetooth disponible.',
      chunkIndex: 1,
      section: 'Conectividad',
      metadata: {},
    });
    await chunks.save({
      documentId: document.id,
      content: 'Bluetooth disponible en esta ficha técnica mucho más extensa.',
      chunkIndex: 2,
      section: 'Conectividad',
      metadata: {},
    });

    const match = await app
      .get(RetrievalService)
      .findBestLexicalMatch('Bluetooth', { productId: product.id });

    expect(match?.id).toBe(first.id);
    expect(match?.lexicalScore).toEqual(expect.any(Number));
  });

  it('filters soft-deleted chunks, documents, products, and non-ready documents', async () => {
    const dataSource = app.get(DataSource);
    const { product, document } = await createAirPodsFixture(app);
    const documents = dataSource.getRepository(RagDocument);
    const chunks = dataSource.getRepository(RagChunk);
    const hiddenContent = 'ocultofiltro';

    await chunks.save({
      documentId: document.id,
      content: hiddenContent,
      chunkIndex: 1,
      metadata: {},
      deletedAt: new Date(),
    });
    const pendingDocument = await documents.save({
      productId: product.id,
      name: 'Documento pendiente',
      sourceType: RagDocumentSourceType.TEXT,
      sourceUri: null,
      mimeType: 'text/plain',
      contentHash: createHash('sha256').update('pending').digest('hex'),
      status: RagDocumentStatus.PENDING,
      processedAt: null,
      metadata: {},
    });
    await chunks.save({
      documentId: pendingDocument.id,
      content: hiddenContent,
      chunkIndex: 0,
      metadata: {},
    });
    const deletedDocument = await documents.save({
      productId: product.id,
      name: 'Documento eliminado',
      sourceType: RagDocumentSourceType.TEXT,
      sourceUri: null,
      mimeType: 'text/plain',
      contentHash: createHash('sha256').update('deleted-doc').digest('hex'),
      status: RagDocumentStatus.READY,
      processedAt: new Date(),
      metadata: {},
      deletedAt: new Date(),
    });
    await chunks.save({
      documentId: deletedDocument.id,
      content: hiddenContent,
      chunkIndex: 0,
      metadata: {},
    });

    const deletedProduct = await dataSource.getRepository(Product).save({
      brandId: product.brandId,
      categoryId: product.categoryId,
      name: 'Producto eliminado',
      slug: `producto-eliminado-${Math.random().toString(36).slice(2)}`,
      deletedAt: new Date(),
    });
    const deletedProductDocument = await documents.save({
      productId: deletedProduct.id,
      name: 'Documento de producto eliminado',
      sourceType: RagDocumentSourceType.TEXT,
      sourceUri: null,
      mimeType: 'text/plain',
      contentHash: createHash('sha256').update('deleted-product').digest('hex'),
      status: RagDocumentStatus.READY,
      processedAt: new Date(),
      metadata: {},
    });
    await chunks.save({
      documentId: deletedProductDocument.id,
      content: hiddenContent,
      chunkIndex: 0,
      metadata: {},
    });

    await expect(
      app.get(RetrievalService).findBestLexicalMatch(hiddenContent),
    ).resolves.toBeNull();
  });
});

async function createAirPodsFixture(app: INestApplication): Promise<{
  product: Product;
  document: RagDocument;
  chunk: RagChunk;
}> {
  const dataSource = app.get(DataSource);
  const suffix = Math.random().toString(36).slice(2);
  const brand = await dataSource.getRepository(Brand).save({
    name: `Apple ${suffix}`,
    slug: `apple-${suffix}`,
  });
  const category = await dataSource.getRepository(Category).save({
    name: `Auriculares ${suffix}`,
    slug: `auriculares-${suffix}`,
  });
  const product = await dataSource.getRepository(Product).save({
    brandId: brand.id,
    categoryId: category.id,
    name: 'AirPods Pro 2',
    slug: `airpods-pro-2-${suffix}`,
  });
  const document = await dataSource.getRepository(RagDocument).save({
    productId: product.id,
    name: 'Especificaciones técnicas de los AirPods Pro 2',
    sourceType: RagDocumentSourceType.TEXT,
    sourceUri: null,
    mimeType: 'text/plain',
    contentHash: createHash('sha256').update(AIRPODS_CONTENT).digest('hex'),
    status: RagDocumentStatus.READY,
    processedAt: new Date(),
    metadata: { fixture: true },
  });
  const chunk = await dataSource.getRepository(RagChunk).save({
    documentId: document.id,
    content: AIRPODS_CONTENT,
    chunkIndex: 0,
    pageStart: 1,
    pageEnd: 1,
    section: 'Especificaciones técnicas',
    metadata: { evidenceKey: 'airpods-conectividad' },
  });

  return { product, document, chunk };
}
