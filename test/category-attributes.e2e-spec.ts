import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { App } from 'supertest/types';
import {
  clearDatabase,
  closeTestApp,
  createAdminToken,
  initTestApp,
} from './test-utils';

describe('Category attributes (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  const request = (target: App) =>
    supertest.agent(target).auth(adminToken, { type: 'bearer' });

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

  it('manages a category attribute template with soft delete', async () => {
    const categoryResponse = await request(
      app.getHttpServer() as unknown as App,
    )
      .post('/api/categories')
      .send({ name: 'Headphones', slug: 'headphones' })
      .expect(201);
    const attributeResponse = await request(
      app.getHttpServer() as unknown as App,
    )
      .post('/api/attributes')
      .send({ name: 'Battery life', slug: 'battery-life', dataType: 'number' })
      .expect(201);
    const categoryId = (categoryResponse.body as { id: string }).id;
    const attributeId = (attributeResponse.body as { id: string }).id;

    const created = await request(app.getHttpServer() as unknown as App)
      .post(`/api/categories/${categoryId}/attributes`)
      .send({ attributeId, position: 2 })
      .expect(201);
    expect((created.body as { position: number }).position).toBe(2);
    expect(created.body).toMatchObject({
      attributeId,
      name: 'Battery life',
    });
    expect(created.body).not.toHaveProperty('categoryId');

    const list = await request(app.getHttpServer() as unknown as App)
      .get(`/api/categories/${categoryId}/attributes`)
      .expect(200);
    const suggestions = list.body as unknown as Array<{
      attributeId: string;
      name: string;
    }>;
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      attributeId,
      name: 'Battery life',
    });
    expect(suggestions[0]).not.toHaveProperty('categoryId');

    await request(app.getHttpServer() as unknown as App)
      .post(`/api/categories/${categoryId}/attributes`)
      .send({ attributeId })
      .expect(409);

    await request(app.getHttpServer() as unknown as App)
      .delete(`/api/categories/${categoryId}/attributes/${attributeId}`)
      .expect(204)
      .expect('');

    await request(app.getHttpServer() as unknown as App)
      .post(`/api/categories/${categoryId}/attributes`)
      .send({ attributeId })
      .expect(201);
  });

  it('rejects missing resources and an invalid position', async () => {
    const categoryId = '3d6f0a36-40ed-4d30-ae15-7f12ab21379a';
    const attributeId = 'e16b2c51-2b8a-4f48-bd68-d81197fe7270';

    await request(app.getHttpServer() as unknown as App)
      .get(`/api/categories/${categoryId}/attributes`)
      .expect(404);

    const categoryResponse = await request(
      app.getHttpServer() as unknown as App,
    )
      .post('/api/categories')
      .send({ name: 'Headphones', slug: 'headphones' })
      .expect(201);
    const existingCategoryId = (categoryResponse.body as { id: string }).id;

    await request(app.getHttpServer() as unknown as App)
      .post(`/api/categories/${existingCategoryId}/attributes`)
      .send({ attributeId, position: -1 })
      .expect(400);
  });
});
