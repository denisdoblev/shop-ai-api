import { ProductSpecificationsController } from './product-specifications.controller';
import { ProductSpecificationsService } from './product-specifications.service';

describe('ProductSpecificationsController', () => {
  const service = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const controller = new ProductSpecificationsController(
    service as unknown as ProductSpecificationsService,
  );
  beforeEach(() => jest.clearAllMocks());

  it('delegates nested resource operations', async () => {
    service.findAll.mockResolvedValue([]);
    service.create.mockResolvedValue({});
    service.update.mockResolvedValue({});
    service.remove.mockResolvedValue(undefined);
    await controller.findAll('product-id');
    await controller.create('product-id', {
      attributeId: 'attribute-id',
      value: 30,
    });
    await controller.update('product-id', 'attribute-id', { value: 40 });
    await controller.remove('product-id', 'attribute-id');
    expect(service.findAll).toHaveBeenCalledWith('product-id');
    expect(service.create).toHaveBeenCalledWith('product-id', {
      attributeId: 'attribute-id',
      value: 30,
    });
    expect(service.update).toHaveBeenCalledWith('product-id', 'attribute-id', {
      value: 40,
    });
    expect(service.remove).toHaveBeenCalledWith('product-id', 'attribute-id');
  });
});
