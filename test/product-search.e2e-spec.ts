import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { App } from 'supertest/types';
import {
  clearDatabase,
  closeTestApp,
  createAdminToken,
  initTestApp,
} from './test-utils';

describe('Product search (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  const api = () => supertest.agent(app.getHttpServer() as unknown as App);
  const admin = () => api().auth(adminToken, { type: 'bearer' });

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

  it('ranks text and combines descendant categories, feature AND, price OR, and independent facets', async () => {
    const brand = await admin()
      .post('/api/brands')
      .send({ name: 'Acme', slug: 'acme' })
      .expect(201);
    const parent = await admin()
      .post('/api/categories')
      .send({ name: 'Computación', slug: 'computacion' })
      .expect(201);
    const child = await admin()
      .post('/api/categories')
      .send({
        name: 'Notebooks',
        slug: 'notebooks',
        parentId: (parent.body as { id: string }).id,
      })
      .expect(201);
    const audio = await admin()
      .post('/api/categories')
      .send({ name: 'Audio', slug: 'audio' })
      .expect(201);
    const wifi = await admin()
      .post('/api/attributes')
      .send({ name: 'Wi-Fi', slug: 'wifi', dataType: 'boolean' })
      .expect(201);
    const touch = await admin()
      .post('/api/attributes')
      .send({ name: 'Pantalla táctil', slug: 'touch', dataType: 'boolean' })
      .expect(201);
    const brandId = (brand.body as { id: string }).id;
    const childId = (child.body as { id: string }).id;
    const audioId = (audio.body as { id: string }).id;
    const wifiId = (wifi.body as { id: string }).id;
    const touchId = (touch.body as { id: string }).id;

    const createProduct = async (
      name: string,
      slug: string,
      categoryId: string,
    ): Promise<string> => {
      const response = await admin()
        .post('/api/products')
        .send({ brandId, categoryId, name, slug })
        .expect(201);
      return (response.body as { id: string }).id;
    };
    const exactId = await createProduct('Notebook', 'notebook', childId);
    const prefixId = await createProduct(
      'Notebook Air',
      'notebook-air',
      childId,
    );
    const contentId = await createProduct(
      'Pro Notebook',
      'pro-notebook',
      audioId,
    );

    for (const [productId, price] of [
      [exactId, 400],
      [prefixId, 1200],
      [contentId, 1600],
    ] as const) {
      await admin()
        .post(`/api/products/${productId}/prices`)
        .send({
          price,
          currency: 'USD',
          recordedAt: '2026-09-01T00:00:00.000Z',
        })
        .expect(201);
    }
    await admin()
      .post(`/api/products/${exactId}/prices`)
      .send({
        price: 350,
        currency: 'EUR',
        recordedAt: '2026-09-02T00:00:00.000Z',
      })
      .expect(201);
    for (const [productId, attributeId] of [
      [exactId, wifiId],
      [exactId, touchId],
      [prefixId, wifiId],
    ]) {
      await admin()
        .post(`/api/products/${productId}/specifications`)
        .send({ attributeId, value: true })
        .expect(201);
    }

    const ranked = await api()
      .get('/api/products/search?q=notebook&limit=10')
      .expect(200);
    expect(
      (ranked.body as { items: Array<{ id: string }> }).items.map(
        (product) => product.id,
      ),
    ).toEqual([exactId, prefixId, contentId]);
    expect(
      (ranked.body as { items: Array<{ price: { currency: string } }> })
        .items[0]?.price.currency,
    ).toBe('EUR');

    const filtered = await api()
      .get('/api/products/search')
      .query({
        categoryId: (parent.body as { id: string }).id,
        featureId: [wifiId, touchId],
        priceRange: ['<500', '>=1500'],
        limit: 10,
      })
      .expect(200);
    const body = filtered.body as {
      items: Array<{ id: string }>;
      facets: {
        categories: Array<{ id: string; count: number }>;
        prices: Array<{ id: string; count: number }>;
      };
      pagination: { total: number };
    };
    expect(body.items.map((product) => product.id)).toEqual([exactId]);
    expect(body.pagination.total).toBe(1);
    expect(
      body.facets.categories.find((facet) => facet.id === childId)?.count,
    ).toBe(1);
    expect(
      body.facets.prices.find((facet) => facet.id === '1000-1499.99')?.count,
    ).toBe(0);
  });

  it('validates repeated filters, price bands, sorting, and pagination', async () => {
    await api().get('/api/products/search?categoryId=invalid').expect(400);
    await api().get('/api/products/search?featureId=invalid').expect(400);
    await api().get('/api/products/search?priceRange=invalid').expect(400);
    await api().get('/api/products/search?sort=invalid').expect(400);
    await api().get('/api/products/search?limit=101').expect(400);
    await api().get('/api/products/search?offset=-1').expect(400);
  });
});
