import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { clearDatabase, closeTestApp, initTestApp } from './test-utils';

describe('Product images (e2e)', () => {
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

  it('lists and creates ordered images for a product', async () => {
    const brand = await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .send({ name: 'Sony', slug: 'sony' });
    const category = await request(app.getHttpServer() as unknown as App)
      .post('/api/categories')
      .send({ name: 'Headphones', slug: 'headphones' });
    const product = await request(app.getHttpServer() as unknown as App)
      .post('/api/products')
      .send({
        brandId: (brand.body as { id: string }).id,
        categoryId: (category.body as { id: string }).id,
        name: 'WH-1000XM6',
        slug: 'sony-wh-1000xm6',
      })
      .expect(201);
    const productId = (product.body as { id: string }).id;

    await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${productId}/images`)
      .send({ url: 'https://cdn.example.com/one.jpg', position: 1 })
      .expect(201);

    const images = await request(app.getHttpServer() as unknown as App)
      .get(`/api/products/${productId}/images`)
      .expect(200);
    expect(images.body).toHaveLength(1);

    await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${productId}/images`)
      .send({ url: 'https://cdn.example.com/duplicate.jpg', position: 1 })
      .expect(409);
  });

  it('rejects a missing product and invalid image input', async () => {
    const productId = '3d6f0a36-40ed-4d30-ae15-7f12ab21379a';
    await request(app.getHttpServer() as unknown as App)
      .get(`/api/products/${productId}/images`)
      .expect(404);
  });
});
