import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ILike, QueryFailedError, Repository } from 'typeorm';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { CategoryAttribute } from './entities/category-attribute.entity';
import { Product } from '../products/entities/product.entity';

describe('CategoriesService', () => {
  const now = new Date('2026-08-29T20:00:00.000Z');
  const category: Category = {
    id: '3d6f0a36-40ed-4d30-ae15-7f12ab21379a',
    parentId: null,
    parent: null,
    name: 'Headphones',
    slug: 'headphones',
    description: null,
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
    existsBy: jest.fn(),
  };
  const productRepository = { existsBy: jest.fn() };
  const categoryAttributeRepository = { existsBy: jest.fn() };
  const service = new CategoriesService(
    repository as unknown as Repository<Category>,
    productRepository as unknown as Repository<Product>,
    categoryAttributeRepository as unknown as Repository<CategoryAttribute>,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a root category with a safe response', async () => {
    repository.create.mockReturnValue(category);
    repository.save.mockResolvedValue(category);

    const result = await service.create({
      name: 'Headphones',
      slug: 'headphones',
    });

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Headphones',
      slug: 'headphones',
    });
    expect(result.parentId).toBeNull();
    expect(result).not.toHaveProperty('parent');
    expect(result).not.toHaveProperty('deletedAt');
  });

  it('requires an active parent when creating a child', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(
      service.create({
        parentId: 'e16b2c51-2b8a-4f48-bd68-d81197fe7270',
        name: 'Wireless',
        slug: 'wireless',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('lists active categories with deterministic pagination', async () => {
    repository.find.mockResolvedValue([category]);

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

  it('filters categories by a case-insensitive partial name', async () => {
    repository.find.mockResolvedValue([category]);

    await expect(
      service.findAll({ limit: 5, offset: 10, name: 'PHONE' }),
    ).resolves.toHaveLength(1);
    expect(repository.find).toHaveBeenCalledWith({
      where: { name: ILike('%PHONE%') },
      take: 5,
      skip: 10,
      order: { name: 'ASC', id: 'ASC' },
    });
  });

  it('throws not found when the category does not exist', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne(category.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects assigning a category as its own parent', async () => {
    repository.findOneBy.mockResolvedValue(category);

    await expect(
      service.update(category.id, { parentId: category.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects assigning a descendant as the parent', async () => {
    const childId = 'e16b2c51-2b8a-4f48-bd68-d81197fe7270';
    repository.findOneBy
      .mockResolvedValueOnce(category)
      .mockResolvedValueOnce({
        ...category,
        id: childId,
        parentId: category.id,
      })
      .mockResolvedValueOnce({
        ...category,
        id: childId,
        parentId: category.id,
      });

    await expect(
      service.update(category.id, { parentId: childId }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('updates and soft-deletes an active category', async () => {
    const updated = { ...category, name: 'Audio Headphones' };
    repository.findOneBy.mockResolvedValue(category);
    repository.merge.mockReturnValue(updated);
    repository.save.mockResolvedValue(updated);
    repository.softRemove.mockResolvedValue(category);
    repository.existsBy.mockResolvedValue(false);
    productRepository.existsBy.mockResolvedValue(false);
    categoryAttributeRepository.existsBy.mockResolvedValue(false);

    await expect(
      service.update(category.id, { name: 'Audio Headphones' }),
    ).resolves.toMatchObject({ name: 'Audio Headphones' });
    await expect(service.remove(category.id)).resolves.toBeUndefined();
    expect(repository.softRemove).toHaveBeenCalledWith(category);
  });

  it('rejects deleting a category with an active reference', async () => {
    repository.findOneBy.mockResolvedValue(category);
    productRepository.existsBy.mockResolvedValue(false);
    repository.existsBy.mockResolvedValue(true);
    categoryAttributeRepository.existsBy.mockResolvedValue(false);

    await expect(service.remove(category.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.existsBy).toHaveBeenCalledWith({
      parentId: category.id,
    });
    expect(repository.softRemove).not.toHaveBeenCalled();
  });

  it('maps an active slug unique violation to conflict', async () => {
    repository.create.mockReturnValue(category);
    repository.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_categories_slug_active',
        }),
      ),
    );

    await expect(
      service.create({ name: 'Headphones', slug: 'headphones' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
