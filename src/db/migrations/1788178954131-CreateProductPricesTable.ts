import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductPricesTable1788178954131 implements MigrationInterface {
  name = 'CreateProductPricesTable1788178954131';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "product_prices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "product_id" uuid NOT NULL, "price" numeric(12,2) NOT NULL, "currency" character(3) NOT NULL, "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "chk_product_prices_currency_uppercase" CHECK (currency = UPPER(currency)), CONSTRAINT "chk_product_prices_price" CHECK (price >= 0), CONSTRAINT "PK_31c33ddacf759f7c0e5d327c4bb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_product_prices_history" ON "product_prices" ("product_id", "recorded_at") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_product_price_recorded_at_active" ON "product_prices" ("product_id", "recorded_at") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_prices" ADD CONSTRAINT "fk_product_prices_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_prices" DROP CONSTRAINT "fk_product_prices_product"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_product_price_recorded_at_active"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_product_prices_history"`);
    await queryRunner.query(`DROP TABLE "product_prices"`);
  }
}
