import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBrandsTable1788047036965 implements MigrationInterface {
  name = 'CreateBrandsTable1788047036965';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "brands" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "name" character varying(100) NOT NULL, "slug" character varying(120) NOT NULL, "logo_url" text, CONSTRAINT "PK_b0c437120b624da1034a81fc561" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_brands_slug_active" ON "brands" ("slug") WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_brands_slug_active"`);
    await queryRunner.query(`DROP TABLE "brands"`);
  }
}
