import { ConflictException, NotFoundException } from '@nestjs/common';
import { ILike, QueryFailedError, Repository } from 'typeorm';
import { BrandsService } from './brands.service';
import { Brand } from './entities/brand.entity';
import { Product } from '../products/entities/product.entity';

describe('BrandsService', () => {
  const now = new Date('2026-08-29T20:00:00.000Z');
  const brand: Brand = {
    id: '3d6f0a36-40ed-4d30-ae15-7f12ab21379a',
    name: 'Sony',
    slug: 'sony',
    logoUrl: null,
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
  const productRepository = { existsBy: jest.fn() };
  const service = new BrandsService(
    repository as unknown as Repository<Brand>,
    productRepository as unknown as Repository<Product>,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a brand and excludes soft-delete state from the response', async () => {
    repository.create.mockReturnValue(brand);
    repository.save.mockResolvedValue(brand);

    const result = await service.create({ name: 'Sony', slug: 'sony' });

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Sony',
      slug: 'sony',
    });
    expect(result).toEqual({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: null,
      createdAt: now,
      updatedAt: now,
    });
    expect(result).not.toHaveProperty('deletedAt');
  });

  it('lists non-deleted brands with deterministic pagination', async () => {
    repository.find.mockResolvedValue([brand]);

    await expect(
      service.findAll({ limit: 10, offset: 20 }),
    ).resolves.toHaveLength(1);
    expect(repository.find).toHaveBeenCalledWith({
      where: {},
      take: 10,
      skip: 20,
      order: { name: 'ASC', id: 'ASC' },
    });
  });

  it('filters brands by a case-insensitive partial name match', async () => {
    repository.find.mockResolvedValue([brand]);

    await expect(
      service.findAll({ limit: 10, offset: 0, name: 'on' }),
    ).resolves.toHaveLength(1);
    expect(repository.find).toHaveBeenCalledWith({
      where: { name: ILike('%on%') },
      take: 10,
      skip: 0,
      order: { name: 'ASC', id: 'ASC' },
    });
  });

  it('throws not found when a non-deleted brand does not exist', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne(brand.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates an existing brand', async () => {
    const updated = { ...brand, name: 'Sony Corporation' };
    repository.findOneBy.mockResolvedValue(brand);
    repository.merge.mockReturnValue(updated);
    repository.save.mockResolvedValue(updated);

    const result = await service.update(brand.id, {
      name: 'Sony Corporation',
    });

    expect(repository.merge).toHaveBeenCalledWith(brand, {
      name: 'Sony Corporation',
    });
    expect(result.name).toBe('Sony Corporation');
  });

  it('soft-deletes an existing brand', async () => {
    repository.findOneBy.mockResolvedValue(brand);
    productRepository.existsBy.mockResolvedValue(false);
    repository.softRemove.mockResolvedValue(brand);

    await expect(service.remove(brand.id)).resolves.toBeUndefined();
    expect(repository.softRemove).toHaveBeenCalledWith(brand);
  });

  it('rejects deleting a brand with active products', async () => {
    repository.findOneBy.mockResolvedValue(brand);
    productRepository.existsBy.mockResolvedValue(true);

    await expect(service.remove(brand.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(productRepository.existsBy).toHaveBeenCalledWith({
      brandId: brand.id,
    });
    expect(repository.softRemove).not.toHaveBeenCalled();
  });

  it('maps a non-deleted slug unique violation to conflict', async () => {
    repository.create.mockReturnValue(brand);
    repository.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_brands_slug_active',
        }),
      ),
    );

    await expect(
      service.create({ name: 'Sony', slug: 'sony' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a non-deleted name unique violation on create to conflict', async () => {
    repository.create.mockReturnValue(brand);
    repository.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_brands_name_active',
        }),
      ),
    );

    await expect(
      service.create({ name: 'sony', slug: 'sony-alt' }),
    ).rejects.toThrow('A non-deleted brand with that name already exists');
  });

  it('maps a non-deleted name unique violation on update to conflict', async () => {
    repository.findOneBy.mockResolvedValue(brand);
    repository.save.mockRejectedValue(
      new QueryFailedError(
        'UPDATE',
        [],
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_brands_name_active',
        }),
      ),
    );

    await expect(
      service.update(brand.id, { name: 'Samsung' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('preserves unknown persistence errors', async () => {
    const error = new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'uq_other_constraint',
      }),
    );
    repository.create.mockReturnValue(brand);
    repository.save.mockRejectedValue(error);

    await expect(service.create({ name: 'Sony', slug: 'sony' })).rejects.toBe(
      error,
    );
  });
});
