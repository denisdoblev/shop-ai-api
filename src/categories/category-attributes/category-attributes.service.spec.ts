import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { Attribute } from '../../attributes/entities/attribute.entity';
import { Category } from '../entities/category.entity';
import { CategoryAttribute } from '../entities/category-attribute.entity';
import { CategoryAttributesService } from './category-attributes.service';

describe('CategoryAttributesService', () => {
  const categoryId = '3d6f0a36-40ed-4d30-ae15-7f12ab21379a';
  const attributeId = 'e16b2c51-2b8a-4f48-bd68-d81197fe7270';
  const now = new Date('2026-08-30T00:00:00.000Z');
  const categoryAttribute: CategoryAttribute = {
    id: 'f7a9589d-30e2-4edc-9d28-dafd6b769023',
    categoryId,
    category: {} as Category,
    attributeId,
    attribute: { name: 'Battery life' } as Attribute,
    position: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const categoryAttributeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    softRemove: jest.fn(),
  };
  const categoryRepository = { findOneBy: jest.fn() };
  const attributeRepository = { findOneBy: jest.fn() };
  const service = new CategoryAttributesService(
    categoryAttributeRepository as unknown as Repository<CategoryAttribute>,
    categoryRepository as unknown as Repository<Category>,
    attributeRepository as unknown as Repository<Attribute>,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a suggestion after validating category and attribute', async () => {
    categoryRepository.findOneBy.mockResolvedValue({ id: categoryId });
    attributeRepository.findOneBy.mockResolvedValue({
      id: attributeId,
      name: 'Battery life',
    });
    const positionedCategoryAttribute = { ...categoryAttribute, position: 2 };
    categoryAttributeRepository.create.mockReturnValue(
      positionedCategoryAttribute,
    );
    categoryAttributeRepository.save.mockResolvedValue(
      positionedCategoryAttribute,
    );

    const result = await service.create(categoryId, {
      attributeId,
      position: 2,
    });

    expect(categoryAttributeRepository.create).toHaveBeenCalledWith({
      categoryId,
      attributeId,
      position: 2,
    });
    expect(result).toMatchObject({
      attributeId,
      name: 'Battery life',
      position: 2,
    });
    expect(result).not.toHaveProperty('categoryId');
    expect(result).not.toHaveProperty('deletedAt');
  });

  it('lists a category template by position', async () => {
    categoryRepository.findOneBy.mockResolvedValue({ id: categoryId });
    categoryAttributeRepository.find.mockResolvedValue([categoryAttribute]);

    await expect(service.findAll(categoryId)).resolves.toHaveLength(1);
    expect(categoryAttributeRepository.find).toHaveBeenCalledWith({
      where: { categoryId },
      relations: { attribute: true },
      order: { position: 'ASC', id: 'ASC' },
    });
  });

  it('rejects a missing category or attribute', async () => {
    categoryRepository.findOneBy.mockResolvedValue(null);

    await expect(service.findAll(categoryId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('soft-deletes an existing suggestion', async () => {
    categoryRepository.findOneBy.mockResolvedValue({ id: categoryId });
    categoryAttributeRepository.findOneBy.mockResolvedValue(categoryAttribute);
    categoryAttributeRepository.softRemove.mockResolvedValue(categoryAttribute);

    await expect(
      service.remove(categoryId, attributeId),
    ).resolves.toBeUndefined();
    expect(categoryAttributeRepository.softRemove).toHaveBeenCalledWith(
      categoryAttribute,
    );
  });

  it('maps an active category-attribute pair conflict', async () => {
    categoryRepository.findOneBy.mockResolvedValue({ id: categoryId });
    attributeRepository.findOneBy.mockResolvedValue({ id: attributeId });
    categoryAttributeRepository.create.mockReturnValue(categoryAttribute);
    categoryAttributeRepository.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_category_attribute_active',
        }),
      ),
    );

    await expect(
      service.create(categoryId, { attributeId }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
