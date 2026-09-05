import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttributesTable1788047933983 implements MigrationInterface {
  name = 'CreateAttributesTable1788047933983';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "attributes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "name" character varying(150) NOT NULL, "slug" character varying(160) NOT NULL, "data_type" character varying(20) NOT NULL, "unit" character varying(50), CONSTRAINT "chk_attributes_data_type" CHECK (data_type IN ('string', 'number', 'boolean')), CONSTRAINT "PK_32216e2e61830211d3a5d7fa72c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_attributes_slug_active" ON "attributes" ("slug") WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_attributes_slug_active"`);
    await queryRunner.query(`DROP TABLE "attributes"`);
  }
}
