import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { ProductFavorite } from './entities/product-favorite.entity';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  const favoriteRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    restore: jest.fn(),
    softRemove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const productRepository = { existsBy: jest.fn() };
  const service = new FavoritesService(
    favoriteRepository as unknown as Repository<ProductFavorite>,
    productRepository as unknown as Repository<Product>,
  );
  const now = new Date('2026-09-01T00:00:00.000Z');
  const favorite = {
    id: 'favorite-id',
    userId: 'user-id',
    productId: 'product-id',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  } as ProductFavorite;

  beforeEach(() => jest.clearAllMocks());

  it('creates once and returns an existing favorite idempotently', async () => {
    productRepository.existsBy.mockResolvedValue(true);
    favoriteRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(favorite);
    favoriteRepository.create.mockReturnValue(favorite);
    favoriteRepository.save.mockResolvedValue(favorite);

    await expect(service.put('user-id', 'product-id')).resolves.toMatchObject({
      productId: 'product-id',
    });
    await expect(service.put('user-id', 'product-id')).resolves.toMatchObject({
      id: 'favorite-id',
    });
    expect(favoriteRepository.save).toHaveBeenCalledTimes(1);
  });

  it('restores a soft-deleted favorite', async () => {
    productRepository.existsBy.mockResolvedValue(true);
    favoriteRepository.findOne.mockResolvedValue({
      ...favorite,
      deletedAt: now,
    });
    favoriteRepository.restore.mockResolvedValue({ affected: 1 });
    favoriteRepository.findOneBy.mockResolvedValue(favorite);

    await expect(service.put('user-id', 'product-id')).resolves.toMatchObject({
      id: 'favorite-id',
    });
    expect(favoriteRepository.restore).toHaveBeenCalledWith('favorite-id');
  });

  it('rejects an absent product and deletes idempotently', async () => {
    productRepository.existsBy.mockResolvedValue(false);
    await expect(service.put('user-id', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    favoriteRepository.findOneBy.mockResolvedValue(null);
    await expect(
      service.remove('user-id', 'product-id'),
    ).resolves.toBeUndefined();
    expect(favoriteRepository.softRemove).not.toHaveBeenCalled();
  });

  it('never exposes userId', async () => {
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([favorite]),
    };
    favoriteRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.findAll('user-id', 'product-id');

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'favorite.user_id = :userId',
      { userId: 'user-id' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'favorite.product_id = :productId',
      { productId: 'product-id' },
    );
    expect(result[0]).not.toHaveProperty('userId');
  });
});
