import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { Brand } from '../brands/entities/brand.entity';
import { Category } from '../categories/entities/category.entity';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

describe('ProductsService', () => {
  const now = new Date('2026-08-30T00:00:00.000Z');
  const brandId = '3d6f0a36-40ed-4d30-ae15-7f12ab21379a';
  const categoryId = 'e16b2c51-2b8a-4f48-bd68-d81197fe7270';
  const product: Product = {
    id: 'f7a9589d-30e2-4edc-9d28-dafd6b769023',
    brandId,
    brand: {} as Brand,
    categoryId,
    category: {} as Category,
    name: 'WH-1000XM6',
    slug: 'sony-wh-1000xm6',
    model: 'WH-1000XM6',
    description: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const productRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    merge: jest.fn(),
    softRemove: jest.fn(),
  };
  const brandRepository = { findOneBy: jest.fn() };
  const categoryRepository = { findOneBy: jest.fn() };
  const service = new ProductsService(
    productRepository as unknown as Repository<Product>,
    brandRepository as unknown as Repository<Brand>,
    categoryRepository as unknown as Repository<Category>,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a product after validating its brand and category', async () => {
    brandRepository.findOneBy.mockResolvedValue({ id: brandId });
    categoryRepository.findOneBy.mockResolvedValue({ id: categoryId });
    productRepository.create.mockReturnValue(product);
    productRepository.save.mockResolvedValue(product);

    const result = await service.create({
      brandId,
      categoryId,
      name: product.name,
      slug: product.slug,
    });

    expect(brandRepository.findOneBy).toHaveBeenCalledWith({ id: brandId });
    expect(categoryRepository.findOneBy).toHaveBeenCalledWith({
      id: categoryId,
    });
    expect(result).toMatchObject({ brandId, categoryId, slug: product.slug });
    expect(result).not.toHaveProperty('deletedAt');
  });

  it('rejects a missing brand or category', async () => {
    brandRepository.findOneBy.mockResolvedValue(null);

    await expect(
      service.create({
        brandId,
        categoryId,
        name: product.name,
        slug: product.slug,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(categoryRepository.findOneBy).not.toHaveBeenCalled();
  });

  it('filters by brand and category with pagination', async () => {
    productRepository.find.mockResolvedValue([product]);

    await expect(
      service.findAll({ limit: 10, offset: 0, brandId, categoryId }),
    ).resolves.toHaveLength(1);
    expect(productRepository.find).toHaveBeenCalledWith({
      where: { brandId, categoryId },
      take: 10,
      skip: 0,
      order: { name: 'ASC', id: 'ASC' },
    });
  });

  it('requires an attribute when filtering by specification values', async () => {
    await expect(
      service.findAll({ limit: 10, offset: 0, specNumberMin: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(productRepository.find).not.toHaveBeenCalled();
  });

  it('rejects specification filters for different value types', async () => {
    await expect(
      service.findAll({
        limit: 10,
        offset: 0,
        specAttributeId: categoryId,
        specStringValue: 'value',
        specBooleanValue: true,
      }),
    ).rejects.toThrow('Specification filters must use only one value type');
  });

  it('rejects an inverted numeric specification range', async () => {
    await expect(
      service.findAll({
        limit: 10,
        offset: 0,
        specAttributeId: categoryId,
        specNumberMin: 20,
        specNumberMax: 10,
      }),
    ).rejects.toThrow(
      'specNumberMin must be less than or equal to specNumberMax',
    );
  });

  it('throws not found for an absent product', async () => {
    productRepository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne(product.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates references and soft-deletes a product', async () => {
    const updated = { ...product, description: 'Updated' };
    productRepository.findOneBy.mockResolvedValue(product);
    productRepository.merge.mockReturnValue(updated);
    productRepository.save.mockResolvedValue(updated);
    productRepository.softRemove.mockResolvedValue(product);

    await expect(
      service.update(product.id, { description: 'Updated' }),
    ).resolves.toMatchObject({ description: 'Updated' });
    await expect(service.remove(product.id)).resolves.toBeUndefined();
    expect(productRepository.softRemove).toHaveBeenCalledWith(product);
  });

  it('maps an active slug unique violation to conflict', async () => {
    brandRepository.findOneBy.mockResolvedValue({ id: brandId });
    categoryRepository.findOneBy.mockResolvedValue({ id: categoryId });
    productRepository.create.mockReturnValue(product);
    productRepository.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_products_slug_active',
        }),
      ),
    );

    await expect(
      service.create({
        brandId,
        categoryId,
        name: product.name,
        slug: product.slug,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
