//NodeJS.ProcessEnv

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    PORT: string;
    DB_HOST: string;
    DB_PORT: string;
    DB_USERNAME: string;
    DB_PASSWORD: string;
    DB_NAME: string;
    TEST_DB_NAME?: string;
    SEED_ADMIN_EMAIL?: string;
    SEED_ADMIN_PASSWORD?: string;
    JWT_SECRET: string;
    SWAGGER_TITLE: string;
    SWAGGER_DESCRIPTION: string;
    SWAGGER_VERSION: string;
    EMBEDDINGS_PROVIDER?: string;
    OLLAMA_BASE_URL?: string;
    OLLAMA_EMBEDDING_MODEL?: string;
    OLLAMA_EMBEDDING_TIMEOUT_MS?: string;
    RAG_PDF_MAX_FILE_SIZE_BYTES?: string;
    RAG_PDF_MAX_PAGES?: string;
  }
}
