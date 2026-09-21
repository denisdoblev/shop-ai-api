import { INestApplication } from '@nestjs/common';
import { join } from 'node:path';
import supertest from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { RagChunk } from '../src/ai/rag/entities/rag-chunk.entity';
import { RagDocumentStatus } from '../src/ai/rag/entities/rag-document-status.enum';
import { RagDocument } from '../src/ai/rag/entities/rag-document.entity';
import { RetrievalService } from '../src/ai/rag/retrieval/retrieval.service';
import { Brand } from '../src/brands/entities/brand.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Product } from '../src/products/entities/product.entity';
import {
  clearDatabase,
  closeTestApp,
  createAdminToken,
  initTestApp,
} from './test-utils';

interface StoredChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  metadata: { pageNumber: number };
  dimensions: number;
}

describe('RAG PDF ingestion integration', () => {
  jest.setTimeout(60_000);

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

  it('ingests a real PDF and retrieves its semantically relevant page', async () => {
    const dataSource = app.get(DataSource);
    const brand = await dataSource.getRepository(Brand).save({
      name: 'Test Audio',
      slug: 'test-audio',
    });
    const category = await dataSource.getRepository(Category).save({
      name: 'Headsets',
      slug: 'headsets',
    });
    const product = await dataSource.getRepository(Product).save({
      brandId: brand.id,
      categoryId: category.id,
      name: 'Conference Headset',
      slug: 'conference-headset',
    });
    const token = await createAdminToken(app);
    const fixturePath = join(__dirname, 'fixtures', 'rag-product-manual.pdf');

    const response = await supertest(app.getHttpServer() as unknown as App)
      .post(`/api/products/${product.id}/rag-documents`)
      .auth(token, { type: 'bearer' })
      .field('chunkSize', '200')
      .field('chunkOverlap', '20')
      .attach('file', fixturePath, { contentType: 'application/pdf' })
      .expect(201);

    const body = response.body as {
      id: string;
      productId: string;
      status: RagDocumentStatus;
      pageCount: number;
      chunkCount: number;
    };
    expect(body).toMatchObject({
      productId: product.id,
      status: RagDocumentStatus.READY,
      pageCount: 2,
      chunkCount: 2,
    });

    const document = await dataSource
      .getRepository(RagDocument)
      .findOneByOrFail({
        id: body.id,
      });
    expect(document).toMatchObject({
      productId: product.id,
      name: 'rag-product-manual.pdf',
      status: RagDocumentStatus.READY,
      pageCount: 2,
    });

    const chunks = await dataSource
      .getRepository(RagChunk)
      .query<StoredChunk[]>(
        `
        SELECT
          id,
          document_id AS "documentId",
          content,
          chunk_index AS "chunkIndex",
          page_start AS "pageStart",
          page_end AS "pageEnd",
          metadata,
          vector_dims(embedding) AS dimensions
        FROM rag_chunks
        WHERE document_id = $1
        ORDER BY chunk_index ASC
      `,
        [document.id],
      );
    expect(chunks).toHaveLength(2);
    expect(chunks.map(({ pageStart }) => pageStart)).toEqual([1, 2]);
    expect(
      chunks.every(({ pageStart, pageEnd }) => pageStart === pageEnd),
    ).toBe(true);
    expect(chunks.map(({ metadata }) => metadata.pageNumber)).toEqual([1, 2]);
    expect(chunks.every(({ dimensions }) => Number(dimensions) === 768)).toBe(
      true,
    );

    const results = await app
      .get(RetrievalService)
      .retrieve('boton fisico para silenciar el microfono', {
        topK: 2,
        productId: product.id,
      });

    expect(results[0]).toMatchObject({
      documentId: document.id,
      productId: product.id,
      chunkIndex: 1,
      metadata: { pageNumber: 2 },
    });
  });
});
