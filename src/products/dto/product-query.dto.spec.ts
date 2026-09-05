import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProductQueryDto } from './product-query.dto';

describe('ProductQueryDto', () => {
  it.each([
    ['true', true],
    ['false', false],
  ])('transforms %s to a boolean', async (value, expected) => {
    const dto = plainToInstance(ProductQueryDto, {
      specBooleanValue: value,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.specBooleanValue).toBe(expected);
  });

  it('rejects values that are not boolean literals', async () => {
    const dto = plainToInstance(ProductQueryDto, {
      specBooleanValue: 'not-a-boolean',
    });

    await expect(validate(dto)).resolves.toHaveLength(1);
  });

  it('accepts negative numeric bounds', async () => {
    const dto = plainToInstance(ProductQueryDto, {
      specNumberMin: '-20.5',
      specNumberMax: '-1',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.specNumberMin).toBe(-20.5);
    expect(dto.specNumberMax).toBe(-1);
  });
});
