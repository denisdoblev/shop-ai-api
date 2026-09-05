import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductPriceDto } from './create-product-price.dto';

describe('CreateProductPriceDto', () => {
  const validPrice = {
    price: 9_999_999_999.99,
    currency: 'USD',
    recordedAt: '2026-08-29T20:00:00Z',
  };

  it('accepts the largest value supported by numeric(12,2)', async () => {
    const dto = plainToInstance(CreateProductPriceDto, validPrice);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a value above the database column maximum', async () => {
    const dto = plainToInstance(CreateProductPriceDto, {
      ...validPrice,
      price: 10_000_000_000,
    });

    await expect(validate(dto)).resolves.toHaveLength(1);
  });
});
