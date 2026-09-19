import { envValidationSchema } from './env-validation.config';

const baseEnvironment = {
  NODE_ENV: 'test',
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'shop_ai_api_test',
  JWT_SECRET: 'test-secret',
  SWAGGER_TITLE: 'Test',
  SWAGGER_DESCRIPTION: 'Test API',
  SWAGGER_VERSION: '1.0.0',
};

describe('embedding environment validation', () => {
  it('applies valid embedding defaults', () => {
    const validation = envValidationSchema.validate(baseEnvironment);

    expect(validation.error).toBeUndefined();
    expect(validation.value as Record<string, unknown>).toMatchObject({
      EMBEDDINGS_PROVIDER: 'ollama',
      OLLAMA_BASE_URL: 'http://localhost:11434',
      OLLAMA_EMBEDDING_MODEL: 'embeddinggemma',
      OLLAMA_EMBEDDING_TIMEOUT_MS: 30_000,
    });
  });

  it.each([
    ['provider', { EMBEDDINGS_PROVIDER: 'unknown' }],
    ['URL', { OLLAMA_BASE_URL: 'not-a-url' }],
    ['timeout', { OLLAMA_EMBEDDING_TIMEOUT_MS: 0 }],
  ])('rejects an invalid %s', (_, override) => {
    const { error } = envValidationSchema.validate({
      ...baseEnvironment,
      ...override,
    });

    expect(error).toBeDefined();
  });
});
