import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductSpecificationsTable1788049746990 implements MigrationInterface {
  name = 'CreateProductSpecificationsTable1788049746990';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "product_specifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "product_id" uuid NOT NULL, "attribute_id" uuid NOT NULL, "string_value" text, "numeric_value" numeric, "boolean_value" boolean, CONSTRAINT "chk_product_specifications_single_value" CHECK (((CASE WHEN string_value IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN numeric_value IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN boolean_value IS NOT NULL THEN 1 ELSE 0 END)) = 1), CONSTRAINT "PK_1936a81a371c31faaddb04331a2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_product_specification_active" ON "product_specifications" ("product_id", "attribute_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_specifications" ADD CONSTRAINT "fk_product_specifications_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_specifications" ADD CONSTRAINT "fk_product_specifications_attribute" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_specifications" DROP CONSTRAINT "fk_product_specifications_attribute"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_specifications" DROP CONSTRAINT "fk_product_specifications_product"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_product_specification_active"`,
    );
    await queryRunner.query(`DROP TABLE "product_specifications"`);
  }
}
