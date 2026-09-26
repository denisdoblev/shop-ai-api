import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import supertest from 'supertest';
import { App } from 'supertest/types';
import {
  LLM_PROVIDER,
  LlmChatInput,
} from '../src/ai/llm/llm-provider.interface';
import { User } from '../src/auth/entities/user.entity';
import { ValidRoles } from '../src/auth/interfaces';
import {
  clearDatabase,
  closeTestApp,
  createAdminToken,
  initTestApp,
} from './test-utils';

describe('AI chat (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let productId: string;
  const api = () => supertest.agent(app.getHttpServer() as unknown as App);
  const chat = (token: string, body: Record<string, unknown>) =>
    api().post('/api/ai/chat').auth(token, { type: 'bearer' }).send(body);

  beforeAll(async () => {
    app = await initTestApp((builder) =>
      builder.overrideProvider(LLM_PROVIDER).useValue({
        chat: jest.fn((input: LlmChatInput) => {
          const toolMessage = input.messages.findLast(
            (message) => message.role === 'tool',
          );
          if (input.tools?.length && toolMessage?.role !== 'tool') {
            return Promise.resolve({
              message: {
                role: 'assistant',
                content: '',
                toolCalls: [{ name: 'get_current_product', arguments: {} }],
              },
              model: 'e2e-llm-model',
            });
          }
          if (toolMessage?.role === 'tool') {
            const result = JSON.parse(toolMessage.content) as {
              latestPrice: { amount: number; currency: string } | null;
            };
            return Promise.resolve({
              message: {
                role: 'assistant',
                content: result.latestPrice
                  ? `Precio: ${result.latestPrice.currency} ${result.latestPrice.amount}`
                  : 'Sin precio.',
              },
              model: 'e2e-llm-model',
            });
          }
          return Promise.resolve({
            message: {
              role: 'assistant',
              content: 'Sí, incluye cancelación activa de ruido.',
            },
            model: 'e2e-llm-model',
          });
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

  it('serves authenticated chat with the current price from the catalog tool', async () => {
    await api()
      .post(`/api/products/${productId}/prices`)
      .auth(adminToken, { type: 'bearer' })
      .send({
        price: 299.99,
        currency: 'USD',
        recordedAt: new Date().toISOString(),
      })
      .expect(201);

    await chat(userToken, {
      message: '¿Cuánto cuesta?',
      context: { currentProductId: productId },
    })
      .expect(200)
      .expect({ answer: 'Precio: USD 299.99', sources: [] });
  });

  it('validates chat auth, nonblank message, context and unknown fields', async () => {
    await api()
      .post('/api/ai/chat')
      .send({ message: 'Question', context: { currentProductId: productId } })
      .expect(401);
    await chat(userToken, {
      message: '   ',
      context: { currentProductId: productId },
    }).expect(400);
    await chat(userToken, {
      message: 'Question',
      context: { currentProductId: 'invalid' },
    }).expect(400);
    await chat(userToken, {
      message: 'Question',
      context: { currentProductId: productId },
      history: [],
    }).expect(400);
  });

  it('rate limits chat per authenticated user', async () => {
    for (let request = 0; request < 5; request += 1) {
      await chat(userToken, {
        message: 'Hola',
        context: { currentProductId: productId },
      }).expect(200);
    }
    await chat(userToken, {
      message: 'Hola',
      context: { currentProductId: productId },
    }).expect(429);
    await chat(adminToken, {
      message: 'Hola',
      context: { currentProductId: productId },
    }).expect(200);
  });

  it('returns the normal 404 for the removed ask route', async () => {
    await api()
      .post('/api/ai/ask')
      .auth(userToken, { type: 'bearer' })
      .send({ productId, question: 'Question' })
      .expect(404);
  });

  it('publishes chat but not the removed ask route in OpenAPI', async () => {
    const response = await api().get('/api/docs-json').expect(200);
    const paths = (response.body as { paths: Record<string, unknown> }).paths;

    expect(paths).toHaveProperty('/api/ai/chat');
    expect(paths).not.toHaveProperty('/api/ai/ask');
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
});
