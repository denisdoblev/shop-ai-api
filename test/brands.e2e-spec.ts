import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { App } from 'supertest/types';
import {
  clearDatabase,
  closeTestApp,
  createAdminToken,
  initTestApp,
} from './test-utils';

describe('Brands (e2e)', () => {
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

  it('supports CRUD with pagination and soft delete', async () => {
    const created = await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .send({
        name: 'Sony',
        slug: 'sony',
        logoUrl: 'https://cdn.example.com/sony.svg',
      })
      .expect(201);

    const body = created.body as unknown as {
      id: string;
      name: string;
      slug: string;
    };
    expect(body.name).toBe('Sony');
    expect(body).not.toHaveProperty('deletedAt');

    const list = await request(app.getHttpServer() as unknown as App)
      .get('/api/brands?limit=5&offset=0')
      .expect(200);
    expect(list.body).toHaveLength(1);

    const filteredList = await request(app.getHttpServer() as unknown as App)
      .get('/api/brands?name=SON&limit=5&offset=0')
      .expect(200);
    expect(filteredList.body).toHaveLength(1);

    const emptyFilteredList = await request(
      app.getHttpServer() as unknown as App,
    )
      .get('/api/brands?name=Samsung&limit=5&offset=0')
      .expect(200);
    expect(emptyFilteredList.body).toHaveLength(0);

    await request(app.getHttpServer() as unknown as App)
      .get(`/api/brands/${body.id}`)
      .expect(200);

    const updated = await request(app.getHttpServer() as unknown as App)
      .patch(`/api/brands/${body.id}`)
      .send({ name: 'Sony Corporation' })
      .expect(200);
    expect((updated.body as { name: string }).name).toBe('Sony Corporation');

    await request(app.getHttpServer() as unknown as App)
      .patch(`/api/brands/${body.id}`)
      .send({ name: null })
      .expect(400);

    await request(app.getHttpServer() as unknown as App)
      .delete(`/api/brands/${body.id}`)
      .expect(204)
      .expect('');

    await request(app.getHttpServer() as unknown as App)
      .get(`/api/brands/${body.id}`)
      .expect(404);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .send({ name: 'sony corporation', slug: 'sony' })
      .expect(201);
  });

  it('rejects duplicate non-deleted names, slugs, and invalid input', async () => {
    const sony = await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .send({ name: 'Sony', slug: 'sony' })
      .expect(201);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .send({ name: 'sony', slug: 'sony-alt' })
      .expect(409);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .send({ name: ' Sony ', slug: 'sony-spaced' })
      .expect(201);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .send({ name: 'Other Sony', slug: 'sony' })
      .expect(409);

    const samsung = await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .send({ name: 'Samsung', slug: 'samsung' })
      .expect(201);

    await request(app.getHttpServer() as unknown as App)
      .patch(`/api/brands/${(samsung.body as { id: string }).id}`)
      .send({ name: 'SONY' })
      .expect(409);

    await request(app.getHttpServer() as unknown as App)
      .patch(`/api/brands/${(sony.body as { id: string }).id}`)
      .send({ name: 'sony' })
      .expect(200);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .send({ name: '', slug: 'invalid', unexpected: true })
      .expect(400);

    await request(app.getHttpServer() as unknown as App)
      .get('/api/brands/not-a-uuid')
      .expect(400);
  });
});
