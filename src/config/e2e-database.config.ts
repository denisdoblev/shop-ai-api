export const TEST_DATABASE_SUFFIX = '_test';

type TestDatabaseSafetyOptions = {
  nodeEnv: string | undefined;
  databaseName: string | undefined;
  developmentDatabaseName?: string | undefined;
  effectiveDatabaseName?: string | undefined;
  dataSourceDatabaseName?: string | undefined;
};

type TestDataSource = {
  isInitialized: boolean;
  options: { database?: unknown };
  initialize(): Promise<unknown>;
  query(query: string): Promise<unknown>;
};

export function assertSafeTestDatabase({
  nodeEnv,
  databaseName,
  developmentDatabaseName,
  effectiveDatabaseName,
  dataSourceDatabaseName,
}: TestDatabaseSafetyOptions): void {
  if (nodeEnv !== 'test') {
    throw new Error('E2E database access requires NODE_ENV=test.');
  }

  const normalizedDatabaseName = databaseName?.trim();
  if (!normalizedDatabaseName) {
    throw new Error('E2E database access requires TEST_DB_NAME.');
  }

  if (!normalizedDatabaseName.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `TEST_DB_NAME must end with "${TEST_DATABASE_SUFFIX}"; received "${normalizedDatabaseName}".`,
    );
  }

  if (
    developmentDatabaseName !== undefined &&
    normalizedDatabaseName === developmentDatabaseName.trim()
  ) {
    throw new Error('TEST_DB_NAME must differ from the development DB_NAME.');
  }

  if (
    effectiveDatabaseName !== undefined &&
    normalizedDatabaseName !== effectiveDatabaseName.trim()
  ) {
    throw new Error(
      `DB_NAME targets "${effectiveDatabaseName}", not the validated test database "${normalizedDatabaseName}".`,
    );
  }

  if (
    dataSourceDatabaseName !== undefined &&
    normalizedDatabaseName !== dataSourceDatabaseName.trim()
  ) {
    throw new Error(
      `The TypeORM datasource targets "${dataSourceDatabaseName}", not the validated test database "${normalizedDatabaseName}".`,
    );
  }
}

export function configureE2eEnvironment(env: NodeJS.ProcessEnv): void {
  const developmentDatabaseName = env.DB_NAME;
  const testDatabaseName = env.TEST_DB_NAME;

  assertSafeTestDatabase({
    nodeEnv: 'test',
    databaseName: testDatabaseName,
    developmentDatabaseName,
  });

  env.NODE_ENV = 'test';
  env.DB_NAME = testDatabaseName?.trim() ?? '';
}

export async function clearTestDatabase(
  dataSource: TestDataSource,
  truncateQuery: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const dataSourceDatabaseName = dataSource.options.database;
  if (typeof dataSourceDatabaseName !== 'string') {
    throw new Error('Unable to verify the TypeORM datasource database name.');
  }

  assertSafeTestDatabase({
    nodeEnv: env.NODE_ENV,
    databaseName: env.TEST_DB_NAME,
    effectiveDatabaseName: env.DB_NAME,
    dataSourceDatabaseName,
  });

  if (!dataSource.isInitialized) await dataSource.initialize();
  await dataSource.query(truncateQuery);
}
