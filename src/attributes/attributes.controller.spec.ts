import { AttributesController } from './attributes.controller';
import { AttributesService } from './attributes.service';
import { AttributeDataType } from './entities/attribute-data-type.enum';

describe('AttributesController', () => {
  const attributesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const controller = new AttributesController(
    attributesService as unknown as AttributesService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('delegates create and paginated listing', async () => {
    const dto = {
      name: 'Battery life',
      slug: 'battery-life',
      dataType: AttributeDataType.NUMBER,
    };
    attributesService.create.mockResolvedValue({ id: 'attribute-id', ...dto });
    attributesService.findAll.mockResolvedValue([]);

    await controller.create(dto);
    await controller.findAll({ limit: 5, offset: 10, name: 'battery' });

    expect(attributesService.create).toHaveBeenCalledWith(dto);
    expect(attributesService.findAll).toHaveBeenCalledWith({
      limit: 5,
      offset: 10,
      name: 'battery',
    });
  });

  it('delegates lookup, update and removal', async () => {
    attributesService.findOne.mockResolvedValue({});
    attributesService.update.mockResolvedValue({});
    attributesService.remove.mockResolvedValue(undefined);

    await controller.findOne('attribute-id');
    await controller.update('attribute-id', { unit: 'hours' });
    await controller.remove('attribute-id');

    expect(attributesService.findOne).toHaveBeenCalledWith('attribute-id');
    expect(attributesService.update).toHaveBeenCalledWith('attribute-id', {
      unit: 'hours',
    });
    expect(attributesService.remove).toHaveBeenCalledWith('attribute-id');
  });
});
