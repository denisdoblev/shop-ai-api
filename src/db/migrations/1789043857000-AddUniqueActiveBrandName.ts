import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueActiveBrandName1789043857000 implements MigrationInterface {
  name = 'AddUniqueActiveBrandName1789043857000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_brands_name_active" ON "brands" (LOWER("name")) WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_brands_name_active"`);
  }
}
