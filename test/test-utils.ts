import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import dataSource from '../src/db/data-source';

export async function initTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return app;
}

export async function closeTestApp(app: INestApplication) {
  try {
    await app.close();
  } catch {
    // ignore
  }

  try {
    if (dataSource.isInitialized) await dataSource.destroy();
  } catch {
    // ignore
  }
}

export async function clearDatabase() {
  try {
    if (!dataSource.isInitialized) await dataSource.initialize();
    // Truncate tables used by tests
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');
  } catch {
    // If DB not available, skip cleanup.
  }
}
