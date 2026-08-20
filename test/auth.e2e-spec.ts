import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { initTestApp, closeTestApp, clearDatabase } from './test-utils';

describe('Auth (e2e)', () => {
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

  it('POST /auth/register (201) - should create a user and return token', async () => {
    const payload = {
      email: 'test@example.com',
      password: 'Abc123',
      fullname: 'Test User',
    };

    const res = await request(app.getHttpServer() as unknown as App)
      .post('/auth/register')
      .send(payload)
      .expect(201);

    const resBody = res.body as unknown as { email: string; token: string };
    expect(resBody).toHaveProperty('token');
    expect(resBody.email).toBe(payload.email.toLowerCase());
  });

  it('POST /auth/login (200) - should login and return token', async () => {
    const payload = {
      email: 'login@example.com',
      password: 'Abc123',
      fullname: 'Login User',
    };

    await request(app.getHttpServer() as unknown as App)
      .post('/auth/register')
      .send(payload);

    const loginRes = await request(app.getHttpServer() as unknown as App)
      .post('/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(201);

    const loginBody = loginRes.body as unknown as {
      email: string;
      token: string;
    };
    expect(loginBody).toHaveProperty('token');
    expect(loginBody.email).toBe(payload.email.toLowerCase());
  });

  it('POST /auth/login (401) - invalid credentials', async () => {
    await request(app.getHttpServer() as unknown as App)
      .post('/auth/login')
      .send({ email: 'no-user@example.com', password: 'BadPass1' })
      .expect(401);
  });

  it('GET /auth/check-status (200) - protected route requires valid token', async () => {
    const payload = {
      email: 'check@example.com',
      password: 'Abc123',
      fullname: 'Check User',
    };

    const reg = await request(app.getHttpServer() as unknown as App)
      .post('/auth/register')
      .send(payload);

    const regBody = reg.body as unknown as { token: string };
    const token = regBody.token;

    const res = await request(app.getHttpServer() as unknown as App)
      .get('/auth/check-status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = res.body as unknown as { email: string; token: string };
    expect(body.email).toBe(payload.email.toLowerCase());
    expect(body).toHaveProperty('token');
  });
});
