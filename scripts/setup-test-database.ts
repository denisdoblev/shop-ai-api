import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { configureE2eEnvironment } from '../src/config/e2e-database.config';

function quotePostgresIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function createTestDatabaseIfMissing(
  testDatabaseName: string,
): Promise<void> {
  const adminDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });

  await adminDataSource.initialize();

  try {
    const rows = (await adminDataSource.query(
      'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS "exists"',
      [testDatabaseName],
    )) as Array<{ exists: boolean }>;

    if (rows[0]?.exists) {
      console.log(`Test database "${testDatabaseName}" already exists.`);
      return;
    }

    await adminDataSource.query(
      `CREATE DATABASE ${quotePostgresIdentifier(testDatabaseName)}`,
    );
    console.log(`Created test database "${testDatabaseName}".`);
  } finally {
    await adminDataSource.destroy();
  }
}

async function runTestDatabaseMigrations(): Promise<void> {
  const { default: testDataSource } = require('../src/db/data-source') as {
    default: DataSource;
  };

  await testDataSource.initialize();

  try {
    const migrations = await testDataSource.runMigrations();
    console.log(
      migrations.length === 0
        ? 'Test database migrations are already up to date.'
        : `Applied ${migrations.length} migration(s) to the test database.`,
    );
  } finally {
    await testDataSource.destroy();
  }
}

async function setupTestDatabase(): Promise<void> {
  dotenv.config({ quiet: true });
  configureE2eEnvironment(process.env);

  const testDatabaseName = process.env.DB_NAME;
  if (!testDatabaseName) {
    throw new Error('Unable to resolve the validated test database name.');
  }

  await createTestDatabaseIfMissing(testDatabaseName);
  await runTestDatabaseMigrations();
}

void setupTestDatabase().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to set up the test database: ${message}`);
  process.exitCode = 1;
});
