import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { configureApplication, setupSwagger } from './config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);

  app.useLogger(app.get(Logger));
  configureApplication(app);

  setupSwagger(app);

  await app.listen(configService.get<number>('PORT', 3000));
}

bootstrap().catch((err) => {
  // top-level error handling for bootstrap
  // log and exit with non-zero code so CI / process managers can detect failure

  console.error(err);
  process.exit(1);
});
