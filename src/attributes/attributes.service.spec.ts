import { ConflictException, NotFoundException } from '@nestjs/common';
import { ILike, QueryFailedError, Repository } from 'typeorm';
import { AttributesService } from './attributes.service';
import { AttributeDataType } from './entities/attribute-data-type.enum';
import { Attribute } from './entities/attribute.entity';
import { CategoryAttribute } from '../categories/entities/category-attribute.entity';
import { ProductSpecification } from '../products/entities/product-specification.entity';

describe('AttributesService', () => {
  const now = new Date('2026-08-29T20:00:00.000Z');
  const attribute: Attribute = {
    id: '3d6f0a36-40ed-4d30-ae15-7f12ab21379a',
    name: 'Battery life',
    slug: 'battery-life',
    dataType: AttributeDataType.NUMBER,
    unit: 'hours',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    merge: jest.fn(),
    softRemove: jest.fn(),
  };
  const categoryAttributeRepository = { existsBy: jest.fn() };
  const productSpecificationRepository = { existsBy: jest.fn() };
  const service = new AttributesService(
    repository as unknown as Repository<Attribute>,
    categoryAttributeRepository as unknown as Repository<CategoryAttribute>,
    productSpecificationRepository as unknown as Repository<ProductSpecification>,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a typed attribute with a safe response', async () => {
    repository.create.mockReturnValue(attribute);
    repository.save.mockResolvedValue(attribute);

    const result = await service.create({
      name: 'Battery life',
      slug: 'battery-life',
      dataType: AttributeDataType.NUMBER,
      unit: 'hours',
    });

    expect(result).toMatchObject({
      name: 'Battery life',
      dataType: AttributeDataType.NUMBER,
      unit: 'hours',
    });
    expect(result).not.toHaveProperty('deletedAt');
  });

  it('lists active attributes with deterministic pagination', async () => {
    repository.find.mockResolvedValue([attribute]);

    await expect(
      service.findAll({ limit: 10, offset: 0 }),
    ).resolves.toHaveLength(1);
    expect(repository.find).toHaveBeenCalledWith({
      where: {},
      take: 10,
      skip: 0,
      order: { name: 'ASC', id: 'ASC' },
    });
  });

  it('filters attributes by a case-insensitive partial name', async () => {
    repository.find.mockResolvedValue([attribute]);

    await expect(
      service.findAll({ limit: 5, offset: 10, name: 'LIFE' }),
    ).resolves.toHaveLength(1);
    expect(repository.find).toHaveBeenCalledWith({
      where: { name: ILike('%LIFE%') },
      take: 5,
      skip: 10,
      order: { name: 'ASC', id: 'ASC' },
    });
  });

  it('throws not found for an absent attribute', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne(attribute.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates and soft-deletes an attribute', async () => {
    const updated = { ...attribute, unit: 'h' };
    repository.findOneBy.mockResolvedValue(attribute);
    repository.merge.mockReturnValue(updated);
    repository.save.mockResolvedValue(updated);
    repository.softRemove.mockResolvedValue(attribute);
    categoryAttributeRepository.existsBy.mockResolvedValue(false);
    productSpecificationRepository.existsBy.mockResolvedValue(false);

    await expect(
      service.update(attribute.id, { unit: 'h' }),
    ).resolves.toMatchObject({
      unit: 'h',
    });
    await expect(service.remove(attribute.id)).resolves.toBeUndefined();
    expect(repository.softRemove).toHaveBeenCalledWith(attribute);
  });

  it('rejects changing the data type when product specifications exist', async () => {
    repository.findOneBy.mockResolvedValue(attribute);
    productSpecificationRepository.existsBy.mockResolvedValue(true);

    await expect(
      service.update(attribute.id, { dataType: AttributeDataType.BOOLEAN }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(productSpecificationRepository.existsBy).toHaveBeenCalledWith({
      attributeId: attribute.id,
    });
    expect(repository.merge).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('allows retaining the data type without checking specifications', async () => {
    repository.findOneBy.mockResolvedValue(attribute);
    repository.save.mockResolvedValue(attribute);

    await expect(
      service.update(attribute.id, { dataType: AttributeDataType.NUMBER }),
    ).resolves.toMatchObject({ dataType: AttributeDataType.NUMBER });
    expect(productSpecificationRepository.existsBy).not.toHaveBeenCalled();
  });

  it('rejects deleting an attribute with an active reference', async () => {
    repository.findOneBy.mockResolvedValue(attribute);
    categoryAttributeRepository.existsBy.mockResolvedValue(false);
    productSpecificationRepository.existsBy.mockResolvedValue(true);

    await expect(service.remove(attribute.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(productSpecificationRepository.existsBy).toHaveBeenCalledWith({
      attributeId: attribute.id,
    });
    expect(repository.softRemove).not.toHaveBeenCalled();
  });

  it('maps an active slug unique violation to conflict', async () => {
    repository.create.mockReturnValue(attribute);
    repository.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_attributes_slug_active',
        }),
      ),
    );

    await expect(
      service.create({
        name: 'Battery life',
        slug: 'battery-life',
        dataType: AttributeDataType.NUMBER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
