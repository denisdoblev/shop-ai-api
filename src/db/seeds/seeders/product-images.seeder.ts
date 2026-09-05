import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProductImage } from '../../../products/entities/product-image.entity';
import { Product } from '../../../products/entities/product.entity';
import { productImagesSeedData } from '../data/product-images.seed-data';
import { Seeder } from './seeder.interface';

@Injectable()
export class ProductImagesSeeder implements Seeder {
  async seed(manager: EntityManager): Promise<void> {
    const productRepository = manager.getRepository(Product);
    const imageRepository = manager.getRepository(ProductImage);

    for (const imageData of productImagesSeedData) {
      const product = await productRepository.findOneBy({
        slug: imageData.productSlug,
      });
      if (!product) {
        throw new Error(`Seed image references a missing product`);
      }

      await imageRepository.upsert(
        {
          productId: product.id,
          url: imageData.url,
          altText: imageData.altText,
          position: imageData.position,
        },
        {
          conflictPaths: ['productId', 'position'],
          indexPredicate: 'deleted_at IS NULL',
          skipUpdateIfNoValuesChanged: true,
        },
      );
    }
  }
}
