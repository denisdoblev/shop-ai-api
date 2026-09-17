import { QueryRunner } from 'typeorm';
import { CreateProductFavoritesTable1789300000000 } from './1789300000000-CreateProductFavoritesTable';

describe('CreateProductFavoritesTable1789300000000', () => {
  const query = jest.fn<Promise<void>, [string]>();
  const queryRunner = { query } as unknown as QueryRunner;
  const migration = new CreateProductFavoritesTable1789300000000();

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue();
  });

  it('creates UUID favorites with restrictive foreign keys and active uniqueness', async () => {
    await migration.up(queryRunner);
    const sql = query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toContain('DEFAULT uuid_generate_v4()');
    expect(sql).toContain('"deleted_at" TIMESTAMP WITH TIME ZONE');
    expect(sql).toContain('uq_product_favorites_active');
    expect(sql).toContain('WHERE deleted_at IS NULL');
    expect(sql.match(/ON DELETE RESTRICT/g)).toHaveLength(2);
  });

  it('removes constraints, indexes, and table on rollback', async () => {
    await migration.down(queryRunner);

    expect(query.mock.calls.at(-1)?.[0]).toBe('DROP TABLE "product_favorites"');
  });
});
