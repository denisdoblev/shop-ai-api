import { QueryRunner, Table } from 'typeorm';
import { CreateUsersTable1756425600000 } from './1756425600000-CreateUsersTable';

describe('CreateUsersTable1756425600000', () => {
  const createTable = jest.fn<Promise<void>, [Table]>();
  const dropTable = jest.fn<Promise<void>, [string]>();
  const queryRunner = { createTable, dropTable } as unknown as QueryRunner;
  const migration = new CreateUsersTable1756425600000();

  beforeEach(() => jest.clearAllMocks());

  it('creates users with a generated UUID primary key and soft delete', async () => {
    createTable.mockResolvedValue();

    await migration.up(queryRunner);

    const table = createTable.mock.calls[0]?.[0];
    expect(table?.name).toBe('users');
    expect(table?.findColumnByName('id')).toMatchObject({
      type: 'uuid',
      isPrimary: true,
      isGenerated: true,
      generationStrategy: 'uuid',
    });
    expect(table?.findColumnByName('deleted_at')).toMatchObject({
      type: 'timestamptz',
      isNullable: true,
    });
  });

  it('drops users on rollback', async () => {
    dropTable.mockResolvedValue();

    await migration.down(queryRunner);

    expect(dropTable).toHaveBeenCalledWith('users');
  });
});
