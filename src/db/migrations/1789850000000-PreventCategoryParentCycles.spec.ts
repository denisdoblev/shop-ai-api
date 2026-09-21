import { QueryRunner } from 'typeorm';
import { PreventCategoryParentCycles1789850000000 } from './1789850000000-PreventCategoryParentCycles';

describe('PreventCategoryParentCycles1789850000000', () => {
  const query = jest.fn<Promise<void>, [string]>();
  const queryRunner = { query } as unknown as QueryRunner;
  const migration = new PreventCategoryParentCycles1789850000000();

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue();
  });

  it('installs the serialized cycle-prevention trigger', async () => {
    await migration.up(queryRunner);

    const statements = query.mock.calls.map(([statement]) => statement);
    expect(statements[0]).toContain('pg_advisory_xact_lock');
    expect(statements[0]).toContain('RAISE EXCEPTION');
    expect(statements[1]).toContain(
      'CREATE TRIGGER trg_categories_prevent_parent_cycle',
    );
  });

  it('removes the trigger and function on rollback', async () => {
    await migration.down(queryRunner);

    expect(query.mock.calls.map(([statement]) => statement)).toEqual([
      'DROP TRIGGER trg_categories_prevent_parent_cycle ON categories',
      'DROP FUNCTION prevent_category_parent_cycle()',
    ]);
  });
});
