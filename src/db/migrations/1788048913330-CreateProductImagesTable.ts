import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductImagesTable1788048913330 implements MigrationInterface {
  name = 'CreateProductImagesTable1788048913330';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "product_images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "product_id" uuid NOT NULL, "url" text NOT NULL, "alt_text" character varying(255), "position" integer NOT NULL DEFAULT '0', CONSTRAINT "chk_product_images_position" CHECK (position >= 0), CONSTRAINT "PK_1974264ea7265989af8392f63a1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_product_image_position_active" ON "product_images" ("product_id", "position") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_images" ADD CONSTRAINT "fk_product_images_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_images" DROP CONSTRAINT "fk_product_images_product"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_product_image_position_active"`,
    );
    await queryRunner.query(`DROP TABLE "product_images"`);
  }
}
