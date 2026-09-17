import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductFavoritesTable1789300000000 implements MigrationInterface {
  name = 'CreateProductFavoritesTable1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "product_favorites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid NOT NULL, "product_id" uuid NOT NULL, CONSTRAINT "PK_product_favorites" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_product_favorites_user_active" ON "product_favorites" ("user_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_product_favorites_active" ON "product_favorites" ("user_id", "product_id") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_favorites" ADD CONSTRAINT "fk_product_favorites_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_favorites" ADD CONSTRAINT "fk_product_favorites_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_favorites" DROP CONSTRAINT "fk_product_favorites_product"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_favorites" DROP CONSTRAINT "fk_product_favorites_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_product_favorites_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_product_favorites_user_active"`,
    );
    await queryRunner.query(`DROP TABLE "product_favorites"`);
  }
}
