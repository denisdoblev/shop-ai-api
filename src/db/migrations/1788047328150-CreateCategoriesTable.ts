import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategoriesTable1788047328150 implements MigrationInterface {
  name = 'CreateCategoriesTable1788047328150';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "parent_id" uuid, "name" character varying(100) NOT NULL, "slug" character varying(120) NOT NULL, "description" text, CONSTRAINT "chk_categories_not_self_parent" CHECK (parent_id IS NULL OR parent_id <> id), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_categories_slug_active" ON "categories" ("slug") WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "fk_categories_parent" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "fk_categories_parent"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_categories_slug_active"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
