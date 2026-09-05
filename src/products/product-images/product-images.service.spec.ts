import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { ProductImage } from '../entities/product-image.entity';
import { Product } from '../entities/product.entity';
import { ProductImagesService } from './product-images.service';

describe('ProductImagesService', () => {
  const productId = '3d6f0a36-40ed-4d30-ae15-7f12ab21379a';
  const now = new Date('2026-08-30T00:00:00.000Z');
  const image: ProductImage = {
    id: 'e16b2c51-2b8a-4f48-bd68-d81197fe7270',
    productId,
    product: {} as Product,
    url: 'https://cdn.example.com/product.jpg',
    altText: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const imageRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };
  const productRepository = { findOneBy: jest.fn() };
  const service = new ProductImagesService(
    imageRepository as unknown as Repository<ProductImage>,
    productRepository as unknown as Repository<Product>,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates an image after validating the product', async () => {
    productRepository.findOneBy.mockResolvedValue({ id: productId });
    imageRepository.create.mockReturnValue(image);
    imageRepository.save.mockResolvedValue(image);

    const result = await service.create(productId, {
      url: image.url,
      position: 2,
    });

    expect(imageRepository.create).toHaveBeenCalledWith({
      productId,
      url: image.url,
      altText: undefined,
      position: 2,
    });
    expect(result).not.toHaveProperty('deletedAt');
  });

  it('lists images ordered by position', async () => {
    productRepository.findOneBy.mockResolvedValue({ id: productId });
    imageRepository.find.mockResolvedValue([image]);

    await expect(service.findAll(productId)).resolves.toHaveLength(1);
    expect(imageRepository.find).toHaveBeenCalledWith({
      where: { productId },
      order: { position: 'ASC', id: 'ASC' },
    });
  });

  it('rejects a missing product', async () => {
    productRepository.findOneBy.mockResolvedValue(null);

    await expect(service.findAll(productId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps an active position unique violation to conflict', async () => {
    productRepository.findOneBy.mockResolvedValue({ id: productId });
    imageRepository.create.mockReturnValue(image);
    imageRepository.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_product_image_position_active',
        }),
      ),
    );

    await expect(
      service.create(productId, { url: image.url }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
