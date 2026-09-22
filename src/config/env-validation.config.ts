import * as Joi from 'joi';

export const databaseEnvValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
});

export const seedEnvValidationSchema = databaseEnvValidationSchema.concat(
  Joi.object({
    SEED_ADMIN_EMAIL: Joi.when('NODE_ENV', {
      is: 'production',
      then: Joi.forbidden(),
      otherwise: Joi.string().trim().email().required(),
    }),
    SEED_ADMIN_PASSWORD: Joi.when('NODE_ENV', {
      is: 'production',
      then: Joi.forbidden(),
      otherwise: Joi.string()
        .min(6)
        .max(20)
        .pattern(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*/)
        .required(),
    }),
  }),
);

export const envValidationSchema = databaseEnvValidationSchema.concat(
  Joi.object({
    PORT: Joi.number().port().default(3000),
    JWT_SECRET: Joi.when('NODE_ENV', {
      is: 'production',
      then: Joi.string().min(32).required(),
      otherwise: Joi.string().required(),
    }),
    SWAGGER_TITLE: Joi.string().required(),
    SWAGGER_DESCRIPTION: Joi.string().required(),
    SWAGGER_VERSION: Joi.string().required(),
    EMBEDDINGS_PROVIDER: Joi.string().valid('ollama').default('ollama'),
    OLLAMA_BASE_URL: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .default('http://localhost:11434'),
    OLLAMA_EMBEDDING_MODEL: Joi.string()
      .trim()
      .min(1)
      .default('embeddinggemma'),
    OLLAMA_EMBEDDING_TIMEOUT_MS: Joi.number()
      .integer()
      .positive()
      .default(30_000),
    LLM_PROVIDER: Joi.string().valid('ollama').default('ollama'),
    OLLAMA_LLM_MODEL: Joi.string().trim().min(1).default('qwen3:8b'),
    OLLAMA_LLM_TIMEOUT_MS: Joi.number().integer().positive().default(120_000),
    RAG_DEFAULT_TOP_K: Joi.number().integer().positive().default(5),
    RAG_STRONG_SIMILARITY_THRESHOLD: Joi.number().min(-1).max(1).default(0.5),
    RAG_MODERATE_SIMILARITY_THRESHOLD: Joi.number()
      .min(-1)
      .max(Joi.ref('RAG_STRONG_SIMILARITY_THRESHOLD'))
      .default(0.4),
    RAG_MINIMUM_SIMILARITY_GAP: Joi.number().min(0).max(2).default(0.12),
    RAG_PDF_MAX_FILE_SIZE_BYTES: Joi.number()
      .integer()
      .positive()
      .default(26_214_400),
    RAG_PDF_MAX_PAGES: Joi.number().integer().positive().default(500),
  }),
);
