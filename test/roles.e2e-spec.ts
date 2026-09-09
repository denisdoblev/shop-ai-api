import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { User } from '../src/auth/entities/user.entity';
import { ValidRoles } from '../src/auth/interfaces';
import { initTestApp, closeTestApp, clearDatabase } from './test-utils';

describe('Roles (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await initTestApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  async function registerUser(email: string): Promise<string> {
    const response = await request(app.getHttpServer() as unknown as App)
      .post('/api/auth/register')
      .send({ email, password: 'Abc123', fullname: 'Role Test User' })
      .expect(201);

    return (response.body as { token: string }).token;
  }

  it('keeps catalog reads public', async () => {
    await request(app.getHttpServer() as unknown as App)
      .get('/api/products')
      .expect(200);
  });

  it('returns 401 for a catalog mutation without a valid token', async () => {
    await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .send({ name: 'Brand', slug: 'brand' })
      .expect(401);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .set('Authorization', 'Bearer not-a-token')
      .send({ name: 'Brand', slug: 'brand' })
      .expect(401);
  });

  it('returns 403 when an authenticated user attempts a catalog mutation', async () => {
    const token = await registerUser('user-role@example.com');

    await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Brand', slug: 'brand' })
      .expect(403);
  });

  it('uses current database roles with an already-issued token', async () => {
    const email = 'admin-role@example.com';
    const token = await registerUser(email);

    await dataSource.getRepository(User).update(
      { email },
      {
        roles: [ValidRoles.ADMIN],
      },
    );

    await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Admin Brand', slug: 'admin-brand' })
      .expect(201);
  });

  it('protects nested catalog mutations', async () => {
    const token = await registerUser('nested-role@example.com');
    const productId = '11111111-1111-4111-8111-111111111111';

    await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${productId}/prices`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        price: 100,
        currency: 'USD',
        recordedAt: '2026-01-01T00:00:00.000Z',
      })
      .expect(403);
  });

  it('rejects an existing token after the user is deactivated', async () => {
    const email = 'inactive-role@example.com';
    const token = await registerUser(email);

    await dataSource.getRepository(User).update({ email }, { isActive: false });

    await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inactive Brand', slug: 'inactive-brand' })
      .expect(401);
  });
});
