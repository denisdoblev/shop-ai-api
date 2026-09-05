import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationDto } from './pagination.dto';

describe('PaginationDto', () => {
  it('applies defaults when values are omitted', async () => {
    const dto = plainToInstance(PaginationDto, {});

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ limit: 10, offset: 0 });
  });

  it('transforms query string values to numbers', async () => {
    const dto = plainToInstance(PaginationDto, { limit: '25', offset: '5' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ limit: 25, offset: 5 });
  });

  it('rejects invalid pagination values', async () => {
    const dto = plainToInstance(PaginationDto, { limit: '0', offset: '-1' });

    await expect(validate(dto)).resolves.toHaveLength(2);
  });

  it('rejects fractional values and limits above the maximum', async () => {
    const fractional = plainToInstance(PaginationDto, {
      limit: '1.5',
      offset: '2.5',
    });
    const excessive = plainToInstance(PaginationDto, { limit: '101' });

    await expect(validate(fractional)).resolves.toHaveLength(2);
    await expect(validate(excessive)).resolves.toHaveLength(1);
  });
});
