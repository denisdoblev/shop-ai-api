import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AttributeDataType } from '../../attributes/entities/attribute-data-type.enum';
import { Attribute } from '../../attributes/entities/attribute.entity';
import { Product } from '../entities/product.entity';
import { ProductSpecification } from '../entities/product-specification.entity';
import { ProductSpecificationsService } from './product-specifications.service';

describe('ProductSpecificationsService', () => {
  const productId = '3d6f0a36-40ed-4d30-ae15-7f12ab21379a';
  const attributeId = 'e16b2c51-2b8a-4f48-bd68-d81197fe7270';
  const specificationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
  };
  const productRepository = { findOneBy: jest.fn() };
  const attributeRepository = { findOneBy: jest.fn() };
  const service = new ProductSpecificationsService(
    specificationRepository as unknown as Repository<ProductSpecification>,
    productRepository as unknown as Repository<Product>,
    attributeRepository as unknown as Repository<Attribute>,
  );
  beforeEach(() => jest.clearAllMocks());

  it.each([
    [
      AttributeDataType.STRING,
      'USB-C',
      { stringValue: 'USB-C', numericValue: null, booleanValue: null },
    ],
    [
      AttributeDataType.NUMBER,
      30,
      { stringValue: null, numericValue: '30', booleanValue: null },
    ],
    [
      AttributeDataType.BOOLEAN,
      true,
      { stringValue: null, numericValue: null, booleanValue: true },
    ],
  ])(
    'stores a %s value in exactly one internal column',
    async (dataType, value, values) => {
      productRepository.findOneBy.mockResolvedValue({ id: productId });
      attributeRepository.findOneBy.mockResolvedValue({
        id: attributeId,
        dataType,
      });
      specificationRepository.create.mockImplementation(
        (input: unknown) => input,
      );
      specificationRepository.save.mockImplementation((input: object) =>
        Promise.resolve({
          id: 'spec-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...input,
        }),
      );
      await service.create(productId, { attributeId, value });
      expect(specificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining(values),
      );
    },
  );

  it('rejects values incompatible with the attribute type', async () => {
    productRepository.findOneBy.mockResolvedValue({ id: productId });
    attributeRepository.findOneBy.mockResolvedValue({
      id: attributeId,
      dataType: AttributeDataType.BOOLEAN,
    });
    await expect(
      service.create(productId, { attributeId, value: 'true' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
