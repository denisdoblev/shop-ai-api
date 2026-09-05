import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { clearDatabase, closeTestApp, initTestApp } from './test-utils';

describe('Categories (e2e)', () => {
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

  it('supports hierarchy, CRUD, pagination and soft delete', async () => {
    const rootResponse = await request(app.getHttpServer() as unknown as App)
      .post('/api/categories')
      .send({ name: 'Electronics', slug: 'electronics' })
      .expect(201);
    const root = rootResponse.body as unknown as {
      id: string;
      parentId: null;
    };
    expect(root.parentId).toBeNull();

    const childResponse = await request(app.getHttpServer() as unknown as App)
      .post('/api/categories')
      .send({
        parentId: root.id,
        name: 'Headphones',
        slug: 'headphones',
        description: 'Personal audio devices',
      })
      .expect(201);
    const child = childResponse.body as unknown as {
      id: string;
      parentId: string;
    };
    expect(child.parentId).toBe(root.id);
    expect(childResponse.body).not.toHaveProperty('parent');
    expect(childResponse.body).not.toHaveProperty('deletedAt');

    await request(app.getHttpServer() as unknown as App)
      .patch(`/api/categories/${root.id}`)
      .send({ parentId: child.id })
      .expect(400);

    const list = await request(app.getHttpServer() as unknown as App)
      .get('/api/categories?limit=10&offset=0')
      .expect(200);
    expect(list.body).toHaveLength(2);

    await request(app.getHttpServer() as unknown as App)
      .patch(`/api/categories/${child.id}`)
      .send({ name: 'Wireless Headphones', parentId: child.id })
      .expect(400);

    const updated = await request(app.getHttpServer() as unknown as App)
      .patch(`/api/categories/${child.id}`)
      .send({ name: 'Wireless Headphones', parentId: null })
      .expect(200);
    expect((updated.body as { parentId: null }).parentId).toBeNull();

    await request(app.getHttpServer() as unknown as App)
      .patch(`/api/categories/${child.id}`)
      .send({ name: null })
      .expect(400);

    await request(app.getHttpServer() as unknown as App)
      .delete(`/api/categories/${child.id}`)
      .expect(204)
      .expect('');
    await request(app.getHttpServer() as unknown as App)
      .get(`/api/categories/${child.id}`)
      .expect(404);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/categories')
      .send({ name: 'New Headphones', slug: 'headphones' })
      .expect(201);
  });

  it('rejects duplicate slugs, absent parents and invalid input', async () => {
    await request(app.getHttpServer() as unknown as App)
      .post('/api/categories')
      .send({ name: 'Electronics', slug: 'electronics' })
      .expect(201);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/categories')
      .send({ name: 'Other Electronics', slug: 'electronics' })
      .expect(409);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/categories')
      .send({
        parentId: '3d6f0a36-40ed-4d30-ae15-7f12ab21379a',
        name: 'Missing Parent',
        slug: 'missing-parent',
      })
      .expect(404);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/categories')
      .send({ name: '', slug: 'invalid', unexpected: true })
      .expect(400);
  });
});
