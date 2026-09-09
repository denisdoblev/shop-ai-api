import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { App } from 'supertest/types';
import {
  clearDatabase,
  closeTestApp,
  createAdminToken,
  initTestApp,
} from './test-utils';

describe('Products (e2e)', () => {
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

  it('supports CRUD, filters, pagination and soft delete', async () => {
    const brandResponse = await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .send({ name: 'Sony', slug: 'sony' })
      .expect(201);
    const categoryResponse = await request(
      app.getHttpServer() as unknown as App,
    )
      .post('/api/categories')
      .send({ name: 'Headphones', slug: 'headphones' })
      .expect(201);
    const brandId = (brandResponse.body as { id: string }).id;
    const categoryId = (categoryResponse.body as { id: string }).id;

    const created = await request(app.getHttpServer() as unknown as App)
      .post('/api/products')
      .send({
        brandId,
        categoryId,
        name: 'WH-1000XM6',
        slug: 'sony-wh-1000xm6',
        model: 'WH-1000XM6',
      })
      .expect(201);
    const product = created.body as unknown as { id: string; brandId: string };
    expect(product.brandId).toBe(brandId);
    expect(created.body).not.toHaveProperty('deletedAt');

    const list = await request(app.getHttpServer() as unknown as App)
      .get(`/api/products?brandId=${brandId}&categoryId=${categoryId}&limit=5`)
      .expect(200);
    expect(list.body).toHaveLength(1);

    await request(app.getHttpServer() as unknown as App)
      .get(`/api/products/${product.id}`)
      .expect(200);

    const updated = await request(app.getHttpServer() as unknown as App)
      .patch(`/api/products/${product.id}`)
      .send({ description: 'Wireless noise-cancelling headphones' })
      .expect(200);
    expect((updated.body as { description: string }).description).toContain(
      'noise-cancelling',
    );

    await request(app.getHttpServer() as unknown as App)
      .patch(`/api/products/${product.id}`)
      .send({ categoryId: null })
      .expect(400);

    await request(app.getHttpServer() as unknown as App)
      .delete(`/api/products/${product.id}`)
      .expect(204)
      .expect('');
    await request(app.getHttpServer() as unknown as App)
      .get(`/api/products/${product.id}`)
      .expect(404);

    await request(app.getHttpServer() as unknown as App)
      .post('/api/products')
      .send({
        brandId,
        categoryId,
        name: 'New WH-1000XM6',
        slug: 'sony-wh-1000xm6',
      })
      .expect(201);
  });

  it('rejects missing references, duplicate slugs and invalid filters', async () => {
    const validId = '3d6f0a36-40ed-4d30-ae15-7f12ab21379a';

    await request(app.getHttpServer() as unknown as App)
      .post('/api/products')
      .send({
        brandId: validId,
        categoryId: validId,
        name: 'Missing references',
        slug: 'missing-references',
      })
      .expect(404);

    await request(app.getHttpServer() as unknown as App)
      .get('/api/products?brandId=invalid')
      .expect(400);

    await request(app.getHttpServer() as unknown as App)
      .get('/api/products?specBooleanValue=not-a-boolean')
      .expect(400);

    await request(app.getHttpServer() as unknown as App)
      .get('/api/products?limit=1.5&offset=2.5')
      .expect(400);

    await request(app.getHttpServer() as unknown as App)
      .get('/api/products?limit=101')
      .expect(400);

    await request(app.getHttpServer() as unknown as App)
      .get(
        `/api/products?specAttributeId=${validId}&specStringValue=value&specBooleanValue=true`,
      )
      .expect(400);

    await request(app.getHttpServer() as unknown as App)
      .get(
        `/api/products?specAttributeId=${validId}&specNumberMin=10&specNumberMax=-10`,
      )
      .expect(400);
  });

  it('filters products by a typed numeric specification range', async () => {
    const brand = await request(app.getHttpServer() as unknown as App)
      .post('/api/brands')
      .send({ name: 'Sony', slug: 'sony' })
      .expect(201);
    const category = await request(app.getHttpServer() as unknown as App)
      .post('/api/categories')
      .send({ name: 'Headphones', slug: 'headphones' })
      .expect(201);
    const brandId = (brand.body as unknown as { id: string }).id;
    const categoryId = (category.body as unknown as { id: string }).id;
    const attribute = await request(app.getHttpServer() as unknown as App)
      .post('/api/attributes')
      .send({ name: 'Battery life', slug: 'battery-life', dataType: 'number' })
      .expect(201);
    const attributeId = (attribute.body as unknown as { id: string }).id;
    const matching = await request(app.getHttpServer() as unknown as App)
      .post('/api/products')
      .send({
        brandId,
        categoryId,
        name: 'WH-1000XM6',
        slug: 'sony-wh-1000xm6',
      })
      .expect(201);
    const nonMatching = await request(app.getHttpServer() as unknown as App)
      .post('/api/products')
      .send({
        brandId,
        categoryId,
        name: 'WF-1000XM6',
        slug: 'sony-wf-1000xm6',
      })
      .expect(201);
    const matchingId = (matching.body as unknown as { id: string }).id;
    const nonMatchingId = (nonMatching.body as unknown as { id: string }).id;

    await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${matchingId}/specifications`)
      .send({ attributeId, value: 30 })
      .expect(201);
    await request(app.getHttpServer() as unknown as App)
      .post(`/api/products/${nonMatchingId}/specifications`)
      .send({ attributeId, value: -10 })
      .expect(201);

    const products = await request(app.getHttpServer() as unknown as App)
      .get(
        `/api/products?specAttributeId=${attributeId}&specNumberMin=25&specNumberMax=35`,
      )
      .expect(200);

    expect(products.body).toHaveLength(1);
    expect((products.body as Array<{ id: string }>)[0]?.id).toBe(matchingId);

    const negativeProducts = await request(
      app.getHttpServer() as unknown as App,
    )
      .get(
        `/api/products?specAttributeId=${attributeId}&specNumberMin=-15&specNumberMax=-5`,
      )
      .expect(200);

    expect(negativeProducts.body).toHaveLength(1);
    expect((negativeProducts.body as Array<{ id: string }>)[0]?.id).toBe(
      nonMatchingId,
    );
  });
});
