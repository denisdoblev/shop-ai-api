import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUsersTable1756425600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'email', type: 'text', isUnique: true },
          { name: 'password', type: 'text' },
          { name: 'fullname', type: 'text' },
          { name: 'is_active', type: 'boolean', default: true },
          {
            name: 'roles',
            type: 'text',
            isArray: true,
            default: "'{user}'::text[]",
          },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
          { name: 'deleted_at', type: 'timestamptz', isNullable: true },
        ],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
