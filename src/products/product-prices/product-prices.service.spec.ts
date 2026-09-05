import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductPrice } from '../entities/product-price.entity';
import { ProductPricesService } from './product-prices.service';

describe('ProductPricesService', () => {
  const productId = '3d6f0a36-40ed-4d30-ae15-7f12ab21379a';
  const recordedAt = new Date('2026-08-29T20:00:00.000Z');
  const price: ProductPrice = {
    id: 'e16b2c51-2b8a-4f48-bd68-d81197fe7270',
    productId,
    product: {} as Product,
    price: '299.99',
    currency: 'USD',
    recordedAt,
    createdAt: recordedAt,
    updatedAt: recordedAt,
    deletedAt: null,
  };
  const productPriceRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };
  const productRepository = { findOneBy: jest.fn() };
  const service = new ProductPricesService(
    productPriceRepository as unknown as Repository<ProductPrice>,
    productRepository as unknown as Repository<Product>,
  );

  beforeEach(() => jest.clearAllMocks());

  it('records a new price without modifying historical prices', async () => {
    productRepository.findOneBy.mockResolvedValue({ id: productId });
    productPriceRepository.create.mockReturnValue(price);
    productPriceRepository.save.mockResolvedValue(price);

    const result = await service.create(productId, {
      price: 299.99,
      currency: 'USD',
      recordedAt: recordedAt.toISOString(),
    });

    expect(productPriceRepository.create).toHaveBeenCalledWith({
      productId,
      price: '299.99',
      currency: 'USD',
      recordedAt,
    });
    expect(result.price).toBe(299.99);
  });

  it('lists prices from newest to oldest', async () => {
    productRepository.findOneBy.mockResolvedValue({ id: productId });
    productPriceRepository.find.mockResolvedValue([price]);

    await expect(service.findAll(productId)).resolves.toHaveLength(1);
    expect(productPriceRepository.find).toHaveBeenCalledWith({
      where: { productId },
      order: { recordedAt: 'DESC', id: 'DESC' },
    });
  });

  it('rejects a missing product', async () => {
    productRepository.findOneBy.mockResolvedValue(null);

    await expect(service.findAll(productId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps a duplicate active timestamp to conflict', async () => {
    productRepository.findOneBy.mockResolvedValue({ id: productId });
    productPriceRepository.create.mockReturnValue(price);
    productPriceRepository.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_product_price_recorded_at_active',
        }),
      ),
    );

    await expect(
      service.create(productId, {
        price: 299.99,
        currency: 'USD',
        recordedAt: recordedAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
