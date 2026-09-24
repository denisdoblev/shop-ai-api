import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRagDocumentDto } from './create-rag-document.dto';

describe('CreateRagDocumentDto', () => {
  it('applies defaults and converts multipart string values', async () => {
    const defaults = plainToInstance(CreateRagDocumentDto, {});
    const transformed = plainToInstance(CreateRagDocumentDto, {
      chunkSize: '800',
      chunkOverlap: '100',
    });

    await expect(validate(defaults)).resolves.toHaveLength(0);
    await expect(validate(transformed)).resolves.toHaveLength(0);
    expect(defaults).toMatchObject({ chunkSize: 400, chunkOverlap: 80 });
    expect(transformed).toMatchObject({ chunkSize: 800, chunkOverlap: 100 });
  });

  it('rejects out-of-range sizes and overlap at least as large as the chunk', async () => {
    const invalidRange = plainToInstance(CreateRagDocumentDto, {
      chunkSize: '199',
      chunkOverlap: '10',
    });
    const invalidOverlap = plainToInstance(CreateRagDocumentDto, {
      chunkSize: '500',
      chunkOverlap: '500',
    });

    expect(await validate(invalidRange)).not.toHaveLength(0);
    expect(await validate(invalidOverlap)).not.toHaveLength(0);
  });
});
