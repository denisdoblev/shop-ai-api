import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  const categoriesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const controller = new CategoriesController(
    categoriesService as unknown as CategoriesService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('delegates create and paginated listing', async () => {
    const dto = { name: 'Headphones', slug: 'headphones' };
    categoriesService.create.mockResolvedValue({ id: 'category-id', ...dto });
    categoriesService.findAll.mockResolvedValue([]);

    await controller.create(dto);
    await controller.findAll({ limit: 5, offset: 10 });

    expect(categoriesService.create).toHaveBeenCalledWith(dto);
    expect(categoriesService.findAll).toHaveBeenCalledWith(5, 10);
  });

  it('delegates lookup, update and removal', async () => {
    categoriesService.findOne.mockResolvedValue({});
    categoriesService.update.mockResolvedValue({});
    categoriesService.remove.mockResolvedValue(undefined);

    await controller.findOne('category-id');
    await controller.update('category-id', { name: 'Updated' });
    await controller.remove('category-id');

    expect(categoriesService.findOne).toHaveBeenCalledWith('category-id');
    expect(categoriesService.update).toHaveBeenCalledWith('category-id', {
      name: 'Updated',
    });
    expect(categoriesService.remove).toHaveBeenCalledWith('category-id');
  });
});
