import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ProductPriceRange,
  ProductSearchQueryDto,
  ProductSearchSort,
} from './product-search-query.dto';

describe('ProductSearchQueryDto', () => {
  const uuid = '3d6f0a36-40ed-4d30-ae15-7f12ab21379a';

  it('normalizes repeated and scalar filters', async () => {
    const query = plainToInstance(ProductSearchQueryDto, {
      q: '  auriculares  ',
      categoryId: uuid,
      featureId: [uuid],
      priceRange: [ProductPriceRange.UNDER_500, ProductPriceRange.FROM_1500],
      limit: '24',
      offset: '12',
      sort: ProductSearchSort.PRICE_ASC,
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query).toMatchObject({
      q: 'auriculares',
      categoryId: [uuid],
      featureId: [uuid],
      limit: 24,
      offset: 12,
    });
  });

  it.each([
    { categoryId: 'invalid' },
    { featureId: 'invalid' },
    { priceRange: 'unknown' },
    { sort: 'unknown' },
    { limit: 101 },
    { offset: -1 },
  ])('rejects invalid search input %#', async (input) => {
    const query = plainToInstance(ProductSearchQueryDto, input);
    await expect(validate(query)).resolves.not.toHaveLength(0);
  });
});
