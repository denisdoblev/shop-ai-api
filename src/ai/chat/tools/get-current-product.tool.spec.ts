import { ProductsService } from '../../../products/products.service';
import {
  GetCurrentProductTool,
  MAX_CURRENT_PRODUCT_TOOL_OUTPUT_CHARS,
} from './get-current-product.tool';

describe('GetCurrentProductTool', () => {
  const productId = '2f4bbf44-43f0-4a5b-bf1b-c7d92e04e4a8';
  const findCatalogDetails = jest.fn();
  const tool = new GetCurrentProductTool({
    findCatalogDetails,
  } as unknown as ProductsService);

  beforeEach(() => jest.clearAllMocks());

  it('bounds oversized catalog data and signals truncation', async () => {
    findCatalogDetails.mockResolvedValue({
      name: 'Headphones',
      model: 'H-1',
      brand: 'Brand',
      category: 'Audio',
      description: '\n'.repeat(20_000),
      latestPrice: null,
      specifications: Array.from({ length: 20 }, (_, index) => ({
        name: `Specification ${index}`,
        value: 'v'.repeat(5_000),
        unit: null,
      })),
    });

    const result = await tool.execute({}, { currentProductId: productId });

    expect(JSON.stringify(result.output).length).toBeLessThanOrEqual(
      MAX_CURRENT_PRODUCT_TOOL_OUTPUT_CHARS,
    );
    expect(result.output).toMatchObject({ truncated: true });
    expect(
      (result.output.specifications as Array<Record<string, unknown>>).length,
    ).toBeLessThan(20);
  });

  it('preserves catalog data that fits the budget', async () => {
    const details = {
      name: 'Headphones',
      model: 'H-1',
      brand: 'Brand',
      category: 'Audio',
      description: 'Compact description',
      latestPrice: null,
      specifications: [{ name: 'Weight', value: 250, unit: 'g' }],
    };
    findCatalogDetails.mockResolvedValue(details);

    await expect(
      tool.execute({}, { currentProductId: productId }),
    ).resolves.toEqual({
      output: { ...details, truncated: false },
      sources: [],
    });
  });
});
