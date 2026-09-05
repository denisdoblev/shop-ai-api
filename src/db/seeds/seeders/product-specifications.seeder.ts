import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AttributeDataType } from '../../../attributes/entities/attribute-data-type.enum';
import { Attribute } from '../../../attributes/entities/attribute.entity';
import { Product } from '../../../products/entities/product.entity';
import { ProductSpecification } from '../../../products/entities/product-specification.entity';
import { productSpecificationsSeedData } from '../data/product-specifications.seed-data';
import { Seeder } from './seeder.interface';

type SpecificationValues = Pick<
  ProductSpecification,
  'stringValue' | 'numericValue' | 'booleanValue'
>;

@Injectable()
export class ProductSpecificationsSeeder implements Seeder {
  async seed(manager: EntityManager): Promise<void> {
    const productRepository = manager.getRepository(Product);
    const attributeRepository = manager.getRepository(Attribute);
    const specificationRepository = manager.getRepository(ProductSpecification);

    for (const specificationData of productSpecificationsSeedData) {
      const product = await productRepository.findOneBy({
        slug: specificationData.productSlug,
      });
      const attribute = await attributeRepository.findOneBy({
        slug: specificationData.attributeSlug,
      });
      if (!product || !attribute) {
        throw new Error(
          `Seed specification references missing product or attribute`,
        );
      }

      await specificationRepository.upsert(
        {
          productId: product.id,
          attributeId: attribute.id,
          ...this.toPersistenceValues(
            attribute.dataType,
            specificationData.value,
          ),
        },
        {
          conflictPaths: ['productId', 'attributeId'],
          indexPredicate: 'deleted_at IS NULL',
          skipUpdateIfNoValuesChanged: true,
        },
      );
    }
  }

  private toPersistenceValues(
    dataType: AttributeDataType,
    value: string | number | boolean,
  ): SpecificationValues {
    if (dataType === AttributeDataType.STRING && typeof value === 'string') {
      return { stringValue: value, numericValue: null, booleanValue: null };
    }
    if (dataType === AttributeDataType.NUMBER && typeof value === 'number') {
      return {
        stringValue: null,
        numericValue: value.toString(),
        booleanValue: null,
      };
    }
    if (dataType === AttributeDataType.BOOLEAN && typeof value === 'boolean') {
      return { stringValue: null, numericValue: null, booleanValue: value };
    }

    throw new Error(`Seed specification value does not match attribute type`);
  }
}
