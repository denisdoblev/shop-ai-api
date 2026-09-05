import { CategoryAttributesController } from './category-attributes.controller';
import { CategoryAttributesService } from './category-attributes.service';

describe('CategoryAttributesController', () => {
  const categoryAttributesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    remove: jest.fn(),
  };
  const controller = new CategoryAttributesController(
    categoryAttributesService as unknown as CategoryAttributesService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('delegates list, creation and removal', async () => {
    const categoryId = 'category-id';
    const attributeId = 'attribute-id';
    const dto = { attributeId, position: 2 };
    categoryAttributesService.findAll.mockResolvedValue([]);
    categoryAttributesService.create.mockResolvedValue({});
    categoryAttributesService.remove.mockResolvedValue(undefined);

    await controller.findAll(categoryId);
    await controller.create(categoryId, dto);
    await controller.remove(categoryId, attributeId);

    expect(categoryAttributesService.findAll).toHaveBeenCalledWith(categoryId);
    expect(categoryAttributesService.create).toHaveBeenCalledWith(
      categoryId,
      dto,
    );
    expect(categoryAttributesService.remove).toHaveBeenCalledWith(
      categoryId,
      attributeId,
    );
  });
});
