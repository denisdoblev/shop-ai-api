import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { closeTestApp, initTestApp } from './test-utils';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await initTestApp();
  });

  afterAll(async () => {
    if (app) await closeTestApp(app);
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer() as unknown as App)
      .get('/api')
      .expect(404);
  });
});
