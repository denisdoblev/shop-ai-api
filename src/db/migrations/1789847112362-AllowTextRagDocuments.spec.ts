import { QueryRunner } from 'typeorm';
import { AllowTextRagDocuments1789847112362 } from './1789847112362-AllowTextRagDocuments';

describe('AllowTextRagDocuments1789847112362', () => {
  const query = jest.fn<Promise<void>, [string]>();
  const queryRunner = { query } as unknown as QueryRunner;
  const migration = new AllowTextRagDocuments1789847112362();

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue();
  });

  it('adds text sources and makes source URIs nullable', async () => {
    await migration.up(queryRunner);

    const statements = query.mock.calls.map(([statement]) => statement);
    expect(statements).toEqual([
      expect.stringContaining(
        'DROP CONSTRAINT "chk_rag_documents_source_type"',
      ),
      expect.stringContaining("source_type IN ('pdf', 'text')"),
      expect.stringContaining('ALTER COLUMN "source_uri" DROP NOT NULL'),
    ]);
  });

  it('guards rollback before restoring the narrower schema', async () => {
    await migration.down(queryRunner);

    const statements = query.mock.calls.map(([statement]) => statement);
    expect(statements[0]).toContain('WHERE "source_type" = \'text\'');
    expect(statements[0]).toContain('WHERE "source_uri" IS NULL');
    expect(statements[0]).toContain('RAISE EXCEPTION');
    expect(statements.slice(1)).toEqual([
      expect.stringContaining(
        'DROP CONSTRAINT "chk_rag_documents_source_type"',
      ),
      expect.stringContaining("source_type IN ('pdf')"),
      expect.stringContaining('ALTER COLUMN "source_uri" SET NOT NULL'),
    ]);
  });
});
