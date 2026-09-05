import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { clearDatabase, closeTestApp, initTestApp } from './test-utils';

describe('Product prices (e2e)', () => {
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

  it('records price history newest first without overwriting records', async () => {
    const brand = await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .send({ name: 'Sony', slug: 'sony' });
    const category = await request(app.getHttpServer() as unknown as App)
      .post('/api/categories')
      .send({ name: 'Headphones', slug: 'headphones' });
    const product = await request(app.getHttpServer() as unknown as App)
      .post('/api/products')
      .send({
        brandId: (brand.body as unknown as { id: string }).id,
        categoryId: (category.body as unknown as { id: string }).id,
        name: 'WH-1000XM6',
        slug: 'sony-wh-1000xm6',
      })
      .expect(201);
    const productId = (product.body as unknown as { id: string }).id;
    const firstRecordedAt = '2026-08-28T20:00:00.000Z';
    const latestRecordedAt = '2026-08-29T20:00:00.000Z';

    await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${productId}/prices`)
      .send({ price: 349.99, currency: 'USD', recordedAt: firstRecordedAt })
      .expect(201);
    const created = await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${productId}/prices`)
      .send({ price: 299.99, currency: 'USD', recordedAt: latestRecordedAt })
      .expect(201);
    expect((created.body as { price: number }).price).toBe(299.99);

    const prices = await request(app.getHttpServer() as unknown as App)
      .get(`/api/products/${productId}/prices`)
      .expect(200);
    expect(prices.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          price: 299.99,
          recordedAt: latestRecordedAt,
        }),
        expect.objectContaining({ price: 349.99, recordedAt: firstRecordedAt }),
      ]),
    );
    expect(
      (prices.body as Array<{ price: number }>).map(({ price }) => price),
    ).toEqual([299.99, 349.99]);

    await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${productId}/prices`)
      .send({ price: 279.99, currency: 'USD', recordedAt: latestRecordedAt })
      .expect(409);
  });

  it('rejects invalid price data and a missing product', async () => {
    const productId = '3d6f0a36-40ed-4d30-ae15-7f12ab21379a';

    await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${productId}/prices`)
      .send({ price: -1, currency: 'usd', recordedAt: 'not-a-date' })
      .expect(400);
    await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${productId}/prices`)
      .send({
        price: 10_000_000_000,
        currency: 'USD',
        recordedAt: '2026-08-29T20:00:00Z',
      })
      .expect(400);
    await request(app.getHttpServer() as unknown as App)
      .get(`/api/products/${productId}/prices`)
      .expect(404);
  });
});
