import * as Joi from 'joi';

export const databaseEnvValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
});

export const envValidationSchema = databaseEnvValidationSchema.concat(
  Joi.object({
    PORT: Joi.number().port().default(3000),
    JWT_SECRET: Joi.string().required(),
    SWAGGER_TITLE: Joi.string().required(),
    SWAGGER_DESCRIPTION: Joi.string().required(),
    SWAGGER_VERSION: Joi.string().required(),
  }),
);
