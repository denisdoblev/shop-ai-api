import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategoryAttributesTable1788048696305 implements MigrationInterface {
  name = 'CreateCategoryAttributesTable1788048696305';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "category_attributes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "category_id" uuid NOT NULL, "attribute_id" uuid NOT NULL, "position" integer NOT NULL DEFAULT '0', CONSTRAINT "chk_category_attributes_position" CHECK (position >= 0), CONSTRAINT "PK_f58b128e30a1ad029b32fb79624" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_category_attribute_active" ON "category_attributes" ("category_id", "attribute_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_attributes" ADD CONSTRAINT "fk_category_attributes_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_attributes" ADD CONSTRAINT "fk_category_attributes_attribute" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "category_attributes" DROP CONSTRAINT "fk_category_attributes_attribute"`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_attributes" DROP CONSTRAINT "fk_category_attributes_category"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_category_attribute_active"`,
    );
    await queryRunner.query(`DROP TABLE "category_attributes"`);
  }
}
