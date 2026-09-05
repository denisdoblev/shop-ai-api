import { ProductPricesController } from './product-prices.controller';
import { ProductPricesService } from './product-prices.service';

describe('ProductPricesController', () => {
  const productPricesService = { create: jest.fn(), findAll: jest.fn() };
  const controller = new ProductPricesController(
    productPricesService as unknown as ProductPricesService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('delegates listing and creation', async () => {
    const productId = 'product-id';
    const dto = {
      price: 299.99,
      currency: 'USD',
      recordedAt: '2026-08-29T20:00:00.000Z',
    };
    productPricesService.findAll.mockResolvedValue([]);
    productPricesService.create.mockResolvedValue({});

    await controller.findAll(productId);
    await controller.create(productId, dto);

    expect(productPricesService.findAll).toHaveBeenCalledWith(productId);
    expect(productPricesService.create).toHaveBeenCalledWith(productId, dto);
  });
});
