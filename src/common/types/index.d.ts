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
    JWT_SECRET: string;
    SWAGGER_TITLE: string;
    SWAGGER_DESCRIPTION: string;
    SWAGGER_VERSION: string;
  }
}
