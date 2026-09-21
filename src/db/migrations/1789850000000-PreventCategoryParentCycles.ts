import { MigrationInterface, QueryRunner } from 'typeorm';

export class PreventCategoryParentCycles1789850000000 implements MigrationInterface {
  name = 'PreventCategoryParentCycles1789850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_category_parent_cycle()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        current_id uuid;
        visited_ids uuid[] := ARRAY[NEW.id];
      BEGIN
        IF NEW.parent_id IS NULL THEN
          RETURN NEW;
        END IF;

        PERFORM pg_advisory_xact_lock(734921);
        current_id := NEW.parent_id;

        WHILE current_id IS NOT NULL LOOP
          IF current_id = ANY(visited_ids) THEN
            RAISE EXCEPTION 'Category parent assignment would create a cycle'
              USING ERRCODE = '23514';
          END IF;

          visited_ids := array_append(visited_ids, current_id);
          SELECT parent_id
          INTO current_id
          FROM categories
          WHERE id = current_id
            AND deleted_at IS NULL;
        END LOOP;

        RETURN NEW;
      END;
      $$;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_categories_prevent_parent_cycle
      BEFORE INSERT OR UPDATE OF parent_id ON categories
      FOR EACH ROW
      EXECUTE FUNCTION prevent_category_parent_cycle()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER trg_categories_prevent_parent_cycle ON categories',
    );
    await queryRunner.query('DROP FUNCTION prevent_category_parent_cycle()');
  }
}
