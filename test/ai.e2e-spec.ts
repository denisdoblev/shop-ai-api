import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import supertest from 'supertest';
import { App } from 'supertest/types';
import { LLM_PROVIDER } from '../src/ai/llm/llm-provider.interface';
import { EMBEDDING_DIMENSIONS } from '../src/ai/rag/embeddings/embedding.constants';
import { EmbeddingsService } from '../src/ai/rag/embeddings/embeddings.service';
import { RagChunk } from '../src/ai/rag/entities/rag-chunk.entity';
import { RagDocumentSourceType } from '../src/ai/rag/entities/rag-document-source-type.enum';
import { RagDocumentStatus } from '../src/ai/rag/entities/rag-document-status.enum';
import { RagDocument } from '../src/ai/rag/entities/rag-document.entity';
import { INSUFFICIENT_INFORMATION_ANSWER } from '../src/ai/rag/grounding-prompt';
import { User } from '../src/auth/entities/user.entity';
import { ValidRoles } from '../src/auth/interfaces';
import {
  clearDatabase,
  closeTestApp,
  createAdminToken,
  initTestApp,
} from './test-utils';

const embeddingValues = [
  1,
  ...Array.from({ length: EMBEDDING_DIMENSIONS - 1 }, () => 0),
];
const embedding = {
  values: embeddingValues,
  model: 'e2e-embedding-model',
  dimensions: EMBEDDING_DIMENSIONS,
};

describe('AI ask (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let productId: string;
  const api = () => supertest.agent(app.getHttpServer() as unknown as App);
  const ask = (token: string, body: Record<string, unknown>) =>
    api().post('/api/ai/ask').auth(token, { type: 'bearer' }).send(body);

  beforeAll(async () => {
    app = await initTestApp((builder) =>
      builder
        .overrideProvider(EmbeddingsService)
        .useValue({
          embedQuery: jest.fn().mockResolvedValue(embedding),
          embedDocuments: jest.fn().mockResolvedValue([embedding]),
        })
        .overrideProvider(LLM_PROVIDER)
        .useValue({
          generate: jest.fn().mockResolvedValue({
            text: 'Sí, incluye cancelación activa de ruido.',
            model: 'e2e-llm-model',
          }),
        }),
    );
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await clearDatabase();
    adminToken = await createAdminToken(app);
    userToken = await createUserToken();
    productId = await createProduct();
  });

  it.each([
    ['user', () => userToken],
    ['admin', () => adminToken],
  ])(
    'allows an authenticated %s and returns answer sources',
    async (_, token) => {
      const { document, chunk } = await seedEvidence();

      const response = await ask(token(), {
        productId,
        question: '¿Tiene cancelación activa de ruido?',
      }).expect(200);

      expect(response.body).toEqual({
        answer: 'Sí, incluye cancelación activa de ruido.',
        sources: [
          {
            chunkId: chunk.id,
            documentId: document.id,
            documentName: document.name,
            productId,
            chunkIndex: 0,
            pageStart: 8,
            pageEnd: 8,
            section: 'Audio',
          },
        ],
      });
      expect(response.body).not.toHaveProperty('pageNumber');
    },
  );

  it('requires authentication', async () => {
    await api()
      .post('/api/ai/ask')
      .send({ productId, question: 'Question' })
      .expect(401);
  });

  it.each([
    ['invalid UUID', () => ({ productId: 'invalid', question: 'Question' })],
    ['an empty question', () => ({ productId, question: '' })],
    ['a blank question', () => ({ productId, question: '   ' })],
    ['an overlong question', () => ({ productId, question: 'a'.repeat(1001) })],
    ['an extra field', () => ({ productId, question: 'Question', topK: 10 })],
  ])('rejects %s', async (_, bodyFactory) => {
    await ask(userToken, bodyFactory()).expect(400);
  });

  it('returns not found for an absent product', async () => {
    await ask(userToken, {
      productId: '3d6f0a36-40ed-4d30-ae15-7f12ab21379a',
      question: 'Question',
    }).expect(404);
  });

  it('returns canonical insufficiency for a product without documents', async () => {
    await ask(userToken, { productId, question: 'Question' })
      .expect(200)
      .expect({ answer: INSUFFICIENT_INFORMATION_ANSWER, sources: [] });
  });

  async function createUserToken(): Promise<string> {
    const user = await app
      .get(DataSource)
      .getRepository(User)
      .save({
        email: 'ai-user@example.com',
        password: 'test-only-unused-password-hash',
        fullname: 'AI User',
        isActive: true,
        roles: [ValidRoles.USER],
      });
    return app.get(JwtService).sign({ id: user.id });
  }

  async function createProduct(): Promise<string> {
    const admin = () => api().auth(adminToken, { type: 'bearer' });
    const brand = await admin()
      .post('/api/brands')
      .send({ name: 'AI Brand', slug: 'ai-brand' })
      .expect(201);
    const category = await admin()
      .post('/api/categories')
      .send({ name: 'AI Category', slug: 'ai-category' })
      .expect(201);
    const product = await admin()
      .post('/api/products')
      .send({
        brandId: (brand.body as { id: string }).id,
        categoryId: (category.body as { id: string }).id,
        name: 'AI Headphones',
        slug: 'ai-headphones',
      })
      .expect(201);
    return (product.body as { id: string }).id;
  }

  async function seedEvidence(): Promise<{
    document: RagDocument;
    chunk: RagChunk;
  }> {
    const dataSource = app.get(DataSource);
    const document = await dataSource.getRepository(RagDocument).save({
      productId,
      name: 'Manual técnico',
      sourceType: RagDocumentSourceType.TEXT,
      sourceUri: null,
      mimeType: 'text/plain',
      contentHash: createHash('sha256')
        .update('cancelación activa de ruido')
        .digest('hex'),
      status: RagDocumentStatus.READY,
      processedAt: new Date(),
      metadata: { e2e: true },
    });
    const chunk = await dataSource.getRepository(RagChunk).save({
      documentId: document.id,
      content: 'Este producto incluye cancelación activa de ruido.',
      chunkIndex: 0,
      pageStart: 8,
      pageEnd: 8,
      section: 'Audio',
      metadata: { e2e: true },
      embedding: embedding.values,
      embeddingModel: embedding.model,
      embeddedAt: new Date(),
    });
    return { document, chunk };
  }
});
