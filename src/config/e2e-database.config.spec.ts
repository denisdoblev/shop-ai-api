import {
  assertSafeTestDatabase,
  clearTestDatabase,
  configureE2eEnvironment,
} from './e2e-database.config';

describe('E2E database configuration', () => {
  it.each([undefined, '', '   '])(
    'rejects a missing test database name (%p)',
    (testDatabaseName) => {
      expect(() =>
        configureE2eEnvironment({
          DB_NAME: 'shop_ai_api',
          TEST_DB_NAME: testDatabaseName,
        } as NodeJS.ProcessEnv),
      ).toThrow('requires TEST_DB_NAME');
    },
  );

  it('rejects a database name without the test suffix', () => {
    expect(() =>
      configureE2eEnvironment({
        DB_NAME: 'shop_ai_api',
        TEST_DB_NAME: 'shop_ai_api_e2e',
      } as NodeJS.ProcessEnv),
    ).toThrow('must end with "_test"');
  });

  it('rejects the development database', () => {
    expect(() =>
      configureE2eEnvironment({
        DB_NAME: 'shop_ai_api_test',
        TEST_DB_NAME: 'shop_ai_api_test',
      } as NodeJS.ProcessEnv),
    ).toThrow('must differ from the development DB_NAME');
  });

  it('selects the validated test database and test environment', () => {
    const env = {
      NODE_ENV: 'development',
      DB_NAME: 'shop_ai_api',
      TEST_DB_NAME: ' shop_ai_api_test ',
    } as NodeJS.ProcessEnv;

    configureE2eEnvironment(env);

    expect(env.NODE_ENV).toBe('test');
    expect(env.DB_NAME).toBe('shop_ai_api_test');
  });

  it('rejects a datasource targeting another database', () => {
    expect(() =>
      assertSafeTestDatabase({
        nodeEnv: 'test',
        databaseName: 'shop_ai_api_test',
        dataSourceDatabaseName: 'shop_ai_api',
      }),
    ).toThrow('TypeORM datasource targets');
  });

  it('rejects an effective DB_NAME targeting another database', () => {
    expect(() =>
      assertSafeTestDatabase({
        nodeEnv: 'test',
        databaseName: 'shop_ai_api_test',
        effectiveDatabaseName: 'shop_ai_api',
      }),
    ).toThrow('DB_NAME targets');
  });

  describe('database cleanup', () => {
    const truncateQuery = 'TRUNCATE TABLE users CASCADE;';

    function createDataSource(database = 'shop_ai_api_test') {
      return {
        isInitialized: false,
        options: { database },
        initialize: jest
          .fn<Promise<unknown>, []>()
          .mockResolvedValue(undefined),
        query: jest
          .fn<Promise<unknown>, [string]>()
          .mockResolvedValue(undefined),
      };
    }

    const safeEnv = {
      NODE_ENV: 'test',
      DB_NAME: 'shop_ai_api_test',
      TEST_DB_NAME: 'shop_ai_api_test',
    } as NodeJS.ProcessEnv;

    it('does not initialize or query when the environment is unsafe', async () => {
      const dataSource = createDataSource();

      await expect(
        clearTestDatabase(dataSource, truncateQuery, {
          ...safeEnv,
          NODE_ENV: 'development',
        }),
      ).rejects.toThrow('requires NODE_ENV=test');
      expect(dataSource.initialize).not.toHaveBeenCalled();
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('initializes and executes the requested cleanup', async () => {
      const dataSource = createDataSource();

      await clearTestDatabase(dataSource, truncateQuery, safeEnv);

      expect(dataSource.initialize).toHaveBeenCalledTimes(1);
      expect(dataSource.query).toHaveBeenCalledWith(truncateQuery);
    });

    it('propagates initialization failures', async () => {
      const dataSource = createDataSource();
      dataSource.initialize.mockRejectedValue(new Error('connection failed'));

      await expect(
        clearTestDatabase(dataSource, truncateQuery, safeEnv),
      ).rejects.toThrow('connection failed');
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('propagates cleanup failures', async () => {
      const dataSource = createDataSource();
      dataSource.query.mockRejectedValue(new Error('truncate failed'));

      await expect(
        clearTestDatabase(dataSource, truncateQuery, safeEnv),
      ).rejects.toThrow('truncate failed');
    });
  });
});
