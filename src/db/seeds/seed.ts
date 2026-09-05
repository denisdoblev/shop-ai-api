import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DatabaseSeederService } from './database-seeder.service';
import { SeedsModule } from './seeds.module';

export async function bootstrapSeeds(): Promise<void> {
  let app: INestApplicationContext | undefined;

  try {
    app = await NestFactory.createApplicationContext(SeedsModule, {
      logger: ['error', 'warn', 'log'],
    });
    await app.get(DatabaseSeederService).seed();
  } finally {
    await app?.close();
  }
}

if (require.main === module) {
  void bootstrapSeeds().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
