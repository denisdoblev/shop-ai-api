import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import dataSource from '../src/db/data-source';
import { configureApplication } from '../src/config';
import { clearTestDatabase } from '../src/config/e2e-database.config';

const TABLES_TO_CLEAR = [
  'product_prices',
  'product_specifications',
  'product_images',
  'category_attributes',
  'products',
  'attributes',
  'categories',
  'brands',
  'users',
].join(', ');

export async function initTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  configureApplication(app);
  await app.init();

  return app;
}

export async function closeTestApp(app: INestApplication): Promise<void> {
  try {
    await app.close();
  } catch {
    // ignore
  }

  await closeTestDatabase();
}

export async function closeTestDatabase(): Promise<void> {
  try {
    if (dataSource.isInitialized) await dataSource.destroy();
  } catch {
    // ignore
  }
}

export async function clearDatabase(): Promise<void> {
  await clearTestDatabase(
    dataSource,
    `TRUNCATE TABLE ${TABLES_TO_CLEAR} RESTART IDENTITY CASCADE;`,
  );
}
