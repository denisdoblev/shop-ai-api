import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductSpecificationFilterIndexes1788291846343 implements MigrationInterface {
  name = 'AddProductSpecificationFilterIndexes1788291846343';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_product_specifications_boolean" ON "product_specifications" ("attribute_id", "boolean_value", "product_id") WHERE deleted_at IS NULL AND boolean_value IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_product_specifications_numeric" ON "product_specifications" ("attribute_id", "numeric_value", "product_id") WHERE deleted_at IS NULL AND numeric_value IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_product_specifications_string" ON "product_specifications" ("attribute_id", "string_value", "product_id") WHERE deleted_at IS NULL AND string_value IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_product_specifications_string"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_product_specifications_numeric"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_product_specifications_boolean"`,
    );
  }
}
