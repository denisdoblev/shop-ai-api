import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProductPrice } from '../../../products/entities/product-price.entity';
import { Product } from '../../../products/entities/product.entity';
import { productPricesSeedData } from '../data/product-prices.seed-data';
import { Seeder } from './seeder.interface';

@Injectable()
export class ProductPricesSeeder implements Seeder {
  async seed(manager: EntityManager): Promise<void> {
    const productRepository = manager.getRepository(Product);

    for (const priceData of productPricesSeedData) {
      const product = await productRepository.findOneBy({
        slug: priceData.productSlug,
      });
      if (!product) {
        throw new Error(`Seed price references a missing product`);
      }

      await manager
        .getRepository(ProductPrice)
        .createQueryBuilder()
        .insert()
        .values({
          productId: product.id,
          price: priceData.price,
          currency: priceData.currency,
          recordedAt: new Date(priceData.recordedAt),
        })
        .orIgnore()
        .execute();
    }
  }
}
