import { DataSource } from 'typeorm';
import {
  ProductPriceRange,
  ProductSearchQueryDto,
  ProductSearchSort,
} from './dto';
import { ProductSearchService } from './product-search.service';

describe('ProductSearchService', () => {
  const queryDatabase = jest.fn<Promise<unknown[]>, [string, unknown[]]>();
  const dataSource = { query: queryDatabase };
  const service = new ProductSearchService(dataSource as unknown as DataSource);

  beforeEach(() => jest.clearAllMocks());

  it('uses five constant aggregate queries and maps the response', async () => {
    const recordedAt = new Date('2026-09-01T00:00:00.000Z');
    queryDatabase
      .mockResolvedValueOnce([
        {
          id: 'product-id',
          name: 'Notebook Pro',
          slug: 'notebook-pro',
          model: 'NP1',
          description: null,
          createdAt: recordedAt,
          brandId: 'brand-id',
          brandName: 'Acme',
          categoryId: 'category-id',
          categoryName: 'Notebooks',
          imageId: 'image-id',
          imageUrl: 'https://example.com/notebook.jpg',
          imageAltText: null,
          price: '1299.99',
          currency: 'USD',
          recordedAt,
        },
      ])
      .mockResolvedValueOnce([{ count: '1' }])
      .mockResolvedValueOnce([
        { id: 'category-id', name: 'Notebooks', count: '1' },
      ])
      .mockResolvedValueOnce([
        { id: ProductPriceRange.FROM_1000_TO_1499, label: 'USD', count: '1' },
      ])
      .mockResolvedValueOnce([{ id: 'feature-id', name: 'Wi-Fi', count: '1' }]);
    const query: ProductSearchQueryDto = {
      q: 'note',
      categoryId: ['3d6f0a36-40ed-4d30-ae15-7f12ab21379a'],
      priceRange: [ProductPriceRange.FROM_1000_TO_1499],
      featureId: ['e16b2c51-2b8a-4f48-bd68-d81197fe7270'],
      sort: ProductSearchSort.RELEVANCE,
      limit: 12,
      offset: 0,
    };

    const result = await service.search(query);

    expect(queryDatabase).toHaveBeenCalledTimes(5);
    expect(result.pagination).toEqual({ limit: 12, offset: 0, total: 1 });
    expect(result.items[0]).toMatchObject({
      id: 'product-id',
      brand: { id: 'brand-id', name: 'Acme' },
      price: { price: 1299.99, currency: 'USD' },
    });
    const statements = queryDatabase.mock.calls.map(([sql]) => sql);
    expect(statements[0]).toContain('CASE');
    expect(statements[0]).toContain('cardinality');
    expect(statements[2]).not.toContain('ancestor_id = ANY');
    expect(statements[3]).not.toContain("'= ANY");
  });

  it('falls back to ascending name order for relevance without a query', async () => {
    queryDatabase
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.search({
      sort: ProductSearchSort.RELEVANCE,
      limit: 10,
      offset: 0,
    });

    expect(queryDatabase.mock.calls[0]?.[0]).toContain(
      'ORDER BY enriched.name ASC, enriched.id ASC',
    );
  });
});
