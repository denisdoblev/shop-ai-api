import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { App } from 'supertest/types';
import {
  clearDatabase,
  closeTestApp,
  createAdminToken,
  initTestApp,
} from './test-utils';

describe('Attributes (e2e)', () => {
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

  it('supports CRUD, pagination and soft delete', async () => {
    const created = await request(app.getHttpServer() as unknown as App)
      .post('/api/attributes')
      .send({
        name: 'Battery life',
        slug: 'battery-life',
        dataType: 'number',
        unit: 'hours',
      })
      .expect(201);
    const attribute = created.body as unknown as { id: string; unit: string };
    expect(attribute.unit).toBe('hours');
    expect(created.body).not.toHaveProperty('deletedAt');

    const list = await request(app.getHttpServer() as unknown as App)
      .get('/api/attributes?limit=5&offset=0')
      .expect(200);
    expect(list.body).toHaveLength(1);

    await request(app.getHttpServer() as unknown as App)
      .get(`/api/attributes/${attribute.id}`)
      .expect(200);

    const updated = await request(app.getHttpServer() as unknown as App)
      .patch(`/api/attributes/${attribute.id}`)
      .send({ dataType: 'boolean', unit: null })
      .expect(200);
    expect((updated.body as { dataType: string; unit: null }).dataType).toBe(
      'boolean',
    );
    expect((updated.body as { unit: null }).unit).toBeNull();

    await request(app.getHttpServer() as unknown as App)
      .patch(`/api/attributes/${attribute.id}`)
      .send({ dataType: null })
      .expect(400);

    await request(app.getHttpServer() as unknown as App)
      .delete(`/api/attributes/${attribute.id}`)
      .expect(204)
      .expect('');
    await request(app.getHttpServer() as unknown as App)
      .get(`/api/attributes/${attribute.id}`)
      .expect(404);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/attributes')
      .send({
        name: 'New battery life',
        slug: 'battery-life',
        dataType: 'number',
      })
      .expect(201);
  });

  it('rejects duplicate slugs and an invalid data type', async () => {
    await request(app.getHttpServer() as unknown as App)
      .post('/api/attributes')
      .send({ name: 'Bluetooth', slug: 'bluetooth', dataType: 'boolean' })
      .expect(201);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/attributes')
      .send({ name: 'Other Bluetooth', slug: 'bluetooth', dataType: 'boolean' })
      .expect(409);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/attributes')
      .send({ name: 'Invalid', slug: 'invalid', dataType: 'date' })
      .expect(400);
  });
});
