import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableVectorExtension1789738394056 implements MigrationInterface {
  name = 'EnableVectorExtension1789738394056';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');
  }

  public async down(): Promise<void> {
    // Keep the extension because it may predate this migration or be shared.
  }
}
