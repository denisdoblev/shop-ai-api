import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { App } from 'supertest/types';
import {
  clearDatabase,
  closeTestApp,
  createAdminToken,
  initTestApp,
} from './test-utils';

describe('Favorites (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  const api = () => supertest.agent(app.getHttpServer() as unknown as App);
  const admin = () => api().auth(adminToken, { type: 'bearer' });

  beforeAll(async () => {
    app = await initTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await clearDatabase();
    adminToken = await createAdminToken(app);
  });

  async function register(email: string): Promise<string> {
    const response = await api()
      .post('/api/auth/register')
      .send({ email, password: 'Secret1', fullname: 'Favorite User' })
      .expect(201);
    return (response.body as { token: string }).token;
  }

  it('isolates users and keeps PUT/DELETE/restoration idempotent', async () => {
    const brand = await admin()
      .post('/api/brands')
      .send({ name: 'Acme', slug: 'acme' })
      .expect(201);
    const category = await admin()
      .post('/api/categories')
      .send({ name: 'Notebooks', slug: 'notebooks' })
      .expect(201);
    const product = await admin()
      .post('/api/products')
      .send({
        brandId: (brand.body as { id: string }).id,
        categoryId: (category.body as { id: string }).id,
        name: 'Notebook',
        slug: 'notebook',
      })
      .expect(201);
    const productId = (product.body as { id: string }).id;
    const firstToken = await register('first@example.com');
    const secondToken = await register('second@example.com');

    await api().put(`/api/favorites/${productId}`).expect(401);
    await api()
      .auth(firstToken, { type: 'bearer' })
      .put('/api/favorites/3d6f0a36-40ed-4d30-ae15-7f12ab21379a')
      .expect(404);

    const created = await api()
      .auth(firstToken, { type: 'bearer' })
      .put(`/api/favorites/${productId}`)
      .expect(200);
    const repeated = await api()
      .auth(firstToken, { type: 'bearer' })
      .put(`/api/favorites/${productId}`)
      .expect(200);
    expect((repeated.body as { id: string }).id).toBe(
      (created.body as { id: string }).id,
    );
    expect(repeated.body).not.toHaveProperty('userId');

    await api()
      .auth(secondToken, { type: 'bearer' })
      .get('/api/favorites')
      .expect(200)
      .expect([]);
    await api()
      .auth(firstToken, { type: 'bearer' })
      .get(`/api/favorites?productId=${productId}`)
      .expect(200)
      .expect(({ body }: { body: unknown[] }) => expect(body).toHaveLength(1));

    await api()
      .auth(firstToken, { type: 'bearer' })
      .delete(`/api/favorites/${productId}`)
      .expect(204);
    await api()
      .auth(firstToken, { type: 'bearer' })
      .delete(`/api/favorites/${productId}`)
      .expect(204);
    const restored = await api()
      .auth(firstToken, { type: 'bearer' })
      .put(`/api/favorites/${productId}`)
      .expect(200);
    expect((restored.body as { id: string }).id).toBe(
      (created.body as { id: string }).id,
    );
  });
});
