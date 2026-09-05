import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

describe('BrandsController', () => {
  const brandsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const controller = new BrandsController(
    brandsService as unknown as BrandsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('delegates creation to the service', async () => {
    const dto = { name: 'Sony', slug: 'sony' };
    brandsService.create.mockResolvedValue({ id: 'brand-id', ...dto });

    await controller.create(dto);

    expect(brandsService.create).toHaveBeenCalledWith(dto);
  });

  it('delegates pagination to the service', async () => {
    brandsService.findAll.mockResolvedValue([]);

    await controller.findAll({ limit: 5, offset: 10 });

    expect(brandsService.findAll).toHaveBeenCalledWith(5, 10);
  });

  it('delegates lookup, update and removal to the service', async () => {
    brandsService.findOne.mockResolvedValue({});
    brandsService.update.mockResolvedValue({});
    brandsService.remove.mockResolvedValue(undefined);

    await controller.findOne('brand-id');
    await controller.update('brand-id', { name: 'Updated' });
    await controller.remove('brand-id');

    expect(brandsService.findOne).toHaveBeenCalledWith('brand-id');
    expect(brandsService.update).toHaveBeenCalledWith('brand-id', {
      name: 'Updated',
    });
    expect(brandsService.remove).toHaveBeenCalledWith('brand-id');
  });
});
