import { QueryRunner } from 'typeorm';
import { EnableVectorExtension1789738394056 } from './1789738394056-EnableVectorExtension';

describe('EnableVectorExtension1789738394056', () => {
  const query = jest.fn<Promise<void>, [string]>();
  const queryRunner = { query } as unknown as QueryRunner;
  const migration = new EnableVectorExtension1789738394056();

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue();
  });

  it('installs vector idempotently', async () => {
    await migration.up(queryRunner);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS vector');
  });

  it('keeps a shared or pre-existing extension on rollback', async () => {
    await migration.down();

    expect(query).not.toHaveBeenCalled();
  });
});
