import { ProductsController } from './products.controller';
import { ProductSearchService } from './product-search.service';
import { ProductsService } from './products.service';
import { ProductSearchSort } from './dto';

describe('ProductsController', () => {
  const productsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const productSearchService = { search: jest.fn() };
  const controller = new ProductsController(
    productsService as unknown as ProductsService,
    productSearchService as unknown as ProductSearchService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('delegates creation and filtered listing', async () => {
    const dto = {
      brandId: '3d6f0a36-40ed-4d30-ae15-7f12ab21379a',
      categoryId: 'e16b2c51-2b8a-4f48-bd68-d81197fe7270',
      name: 'WH-1000XM6',
      slug: 'sony-wh-1000xm6',
    };
    const query = { limit: 5, offset: 0, brandId: dto.brandId };
    productsService.create.mockResolvedValue({ id: 'product-id', ...dto });
    productsService.findAll.mockResolvedValue([]);

    await controller.create(dto);
    await controller.findAll(query);

    expect(productsService.create).toHaveBeenCalledWith(dto);
    expect(productsService.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates lookup, update and removal', async () => {
    productsService.findOne.mockResolvedValue({});
    productsService.update.mockResolvedValue({});
    productsService.remove.mockResolvedValue(undefined);

    await controller.findOne('product-id');
    await controller.update('product-id', { name: 'Updated' });
    await controller.remove('product-id');

    expect(productsService.findOne).toHaveBeenCalledWith('product-id');
    expect(productsService.update).toHaveBeenCalledWith('product-id', {
      name: 'Updated',
    });
    expect(productsService.remove).toHaveBeenCalledWith('product-id');
  });

  it('delegates faceted search', async () => {
    const query = {
      limit: 20,
      offset: 0,
      sort: ProductSearchSort.RELEVANCE,
    };
    productSearchService.search.mockResolvedValue({ items: [] });

    await controller.search(query);

    expect(productSearchService.search).toHaveBeenCalledWith(query);
  });
});
