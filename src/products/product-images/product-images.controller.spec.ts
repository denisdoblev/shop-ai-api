import { ProductImagesController } from './product-images.controller';
import { ProductImagesService } from './product-images.service';

describe('ProductImagesController', () => {
  const productImagesService = { create: jest.fn(), findAll: jest.fn() };
  const controller = new ProductImagesController(
    productImagesService as unknown as ProductImagesService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('delegates listing and creation', async () => {
    const productId = 'product-id';
    const dto = { url: 'https://cdn.example.com/product.jpg', position: 1 };
    productImagesService.findAll.mockResolvedValue([]);
    productImagesService.create.mockResolvedValue({});

    await controller.findAll(productId);
    await controller.create(productId, dto);

    expect(productImagesService.findAll).toHaveBeenCalledWith(productId);
    expect(productImagesService.create).toHaveBeenCalledWith(productId, dto);
  });
});
