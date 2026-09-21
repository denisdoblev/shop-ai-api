import {
  envValidationSchema,
  seedEnvValidationSchema,
} from './env-validation.config';

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

describe('AI environment validation', () => {
  it('applies valid embedding and PDF ingestion defaults', () => {
    const validation = envValidationSchema.validate(baseEnvironment);

    expect(validation.error).toBeUndefined();
    expect(validation.value as Record<string, unknown>).toMatchObject({
      EMBEDDINGS_PROVIDER: 'ollama',
      OLLAMA_BASE_URL: 'http://localhost:11434',
      OLLAMA_EMBEDDING_MODEL: 'embeddinggemma',
      OLLAMA_EMBEDDING_TIMEOUT_MS: 30_000,
      RAG_PDF_MAX_FILE_SIZE_BYTES: 26_214_400,
      RAG_PDF_MAX_PAGES: 500,
    });
  });

  it.each([
    ['provider', { EMBEDDINGS_PROVIDER: 'unknown' }],
    ['URL', { OLLAMA_BASE_URL: 'not-a-url' }],
    ['timeout', { OLLAMA_EMBEDDING_TIMEOUT_MS: 0 }],
    ['PDF file size', { RAG_PDF_MAX_FILE_SIZE_BYTES: 0 }],
    ['PDF page count', { RAG_PDF_MAX_PAGES: 1.5 }],
  ])('rejects an invalid %s', (_, override) => {
    const { error } = envValidationSchema.validate({
      ...baseEnvironment,
      ...override,
    });

    expect(error).toBeDefined();
  });

  it('requires a long JWT secret in production', () => {
    const { error } = envValidationSchema.validate({
      ...baseEnvironment,
      NODE_ENV: 'production',
      JWT_SECRET: 'short-secret',
    });

    expect(error).toBeDefined();
  });

  it('accepts a long JWT secret in production', () => {
    const { error } = envValidationSchema.validate({
      ...baseEnvironment,
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
    });

    expect(error).toBeUndefined();
  });
});

describe('seed environment validation', () => {
  const seedEnvironment = {
    ...baseEnvironment,
    SEED_ADMIN_EMAIL: 'local-admin@example.com',
    SEED_ADMIN_PASSWORD: 'LocalSeed9',
  };

  it('accepts explicit administrator credentials outside production', () => {
    expect(
      seedEnvValidationSchema.validate(seedEnvironment, { allowUnknown: true })
        .error,
    ).toBeUndefined();
  });

  it.each([
    ['missing email', { SEED_ADMIN_EMAIL: undefined }],
    ['invalid email', { SEED_ADMIN_EMAIL: 'not-an-email' }],
    ['missing password', { SEED_ADMIN_PASSWORD: undefined }],
    ['invalid password', { SEED_ADMIN_PASSWORD: 'weak' }],
  ])('rejects %s', (_, override) => {
    const validation = seedEnvValidationSchema.validate(
      { ...seedEnvironment, ...override },
      { allowUnknown: true },
    );

    expect(validation.error).toBeDefined();
  });

  it('rejects administrator seed credentials in production', () => {
    const validation = seedEnvValidationSchema.validate(
      { ...seedEnvironment, NODE_ENV: 'production' },
      { allowUnknown: true },
    );

    expect(validation.error).toBeDefined();
  });

  it('allows production catalog seeding without administrator credentials', () => {
    const validation = seedEnvValidationSchema.validate(
      { ...baseEnvironment, NODE_ENV: 'production' },
      { allowUnknown: true },
    );

    expect(validation.error).toBeUndefined();
  });
});
