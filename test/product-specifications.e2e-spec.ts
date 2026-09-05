import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { clearDatabase, closeTestApp, initTestApp } from './test-utils';

describe('Product specifications (e2e)', () => {
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

  it('stores and returns typed EAV values through the public contract', async () => {
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
      });
    const attribute = await request(app.getHttpServer() as unknown as App)
      .post('/api/attributes')
      .send({ name: 'Battery life', slug: 'battery-life', dataType: 'number' });
    const productId = (product.body as unknown as { id: string }).id;
    const attributeId = (attribute.body as unknown as { id: string }).id;
    const created = await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${productId}/specifications`)
      .send({ attributeId, value: 30 })
      .expect(201);
    expect((created.body as { value: number }).value).toBe(30);
    await request(app.getHttpServer() as unknown as App)
      .patch(`/api/attributes/${attributeId}`)
      .send({ dataType: 'boolean' })
      .expect(409);
    await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${productId}/specifications`)
      .send({ attributeId, value: 31 })
      .expect(409);
    await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${productId}/specifications`)
      .send({ attributeId, value: '30' })
      .expect(400);
    const updated = await request(app.getHttpServer() as unknown as App)
      .patch(`/api/products/${productId}/specifications/${attributeId}`)
      .send({ value: 35 })
      .expect(200);
    expect((updated.body as { value: number }).value).toBe(35);
    await request(app.getHttpServer() as unknown as App)
      .delete(`/api/products/${productId}/specifications/${attributeId}`)
      .expect(204);
    await request(app.getHttpServer() as unknown as App)
      .get(`/api/products/${productId}/specifications`)
      .expect(200)
      .expect([]);
  });

  it('rejects a value incompatible with the attribute data type', async () => {
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
      });
    const attribute = await request(app.getHttpServer() as unknown as App)
      .post('/api/attributes')
      .send({ name: 'Bluetooth', slug: 'bluetooth', dataType: 'boolean' });
    const productId = (product.body as unknown as { id: string }).id;
    const attributeId = (attribute.body as unknown as { id: string }).id;
    await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${productId}/specifications`)
      .send({ attributeId, value: 'true' })
      .expect(400);
  });
});
