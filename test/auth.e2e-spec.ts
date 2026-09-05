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

  it('POST /api/auth/register (201) - creates a user safely', async () => {
    const payload = {
      email: 'test@example.com',
      password: 'Abc123',
      fullname: 'Test User',
    };

    const res = await request(app.getHttpServer() as unknown as App)
      .post('/api/auth/register')
      .send(payload)
      .expect(201);

    const resBody = res.body as unknown as {
      id: string;
      email: string;
      fullname: string;
      isActive: boolean;
      roles: string[];
      token: string;
    };
    expect(resBody.id).toEqual(expect.any(String));
    expect(resBody).toHaveProperty('token');
    expect(resBody.email).toBe(payload.email.toLowerCase());
    expect(resBody.fullname).toBe(payload.fullname);
    expect(resBody).not.toHaveProperty('password');
    expect(resBody).not.toHaveProperty('createdAt');
  });

  it('POST /api/auth/login (201) - logs in with the common response', async () => {
    const payload = {
      email: 'login@example.com',
      password: 'Abc123',
      fullname: 'Login User',
    };

    await request(app.getHttpServer() as unknown as App)
      .post('/api/auth/register')
      .send(payload);

    const loginRes = await request(app.getHttpServer() as unknown as App)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(201);

    const loginBody = loginRes.body as unknown as {
      email: string;
      token: string;
    };
    expect(loginBody).toHaveProperty('token');
    expect(loginBody.email).toBe(payload.email.toLowerCase());
  });

  it('POST /api/auth/login (401) - rejects invalid credentials', async () => {
    await request(app.getHttpServer() as unknown as App)
      .post('/api/auth/login')
      .send({ email: 'no-user@example.com', password: 'BadPass1' })
      .expect(401);
  });

  it('GET /api/auth/check-status (200) - requires a valid token', async () => {
    const payload = {
      email: 'check@example.com',
      password: 'Abc123',
      fullname: 'Check User',
    };

    const reg = await request(app.getHttpServer() as unknown as App)
      .post('/api/auth/register')
      .send(payload);

    const regBody = reg.body as unknown as { token: string };
    const token = regBody.token;

    const res = await request(app.getHttpServer() as unknown as App)
      .get('/api/auth/check-status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = res.body as unknown as { email: string; token: string };
    expect(body.email).toBe(payload.email.toLowerCase());
    expect(body).toHaveProperty('token');
  });

  it('POST /api/auth/register (400) - rejects non-whitelisted fields', async () => {
    await request(app.getHttpServer() as unknown as App)
      .post('/api/auth/register')
      .send({
        email: 'extra@example.com',
        password: 'Abc123',
        fullname: 'Extra Field',
        unexpected: true,
      })
      .expect(400);
  });
});
