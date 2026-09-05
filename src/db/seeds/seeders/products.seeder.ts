import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Brand } from '../../../brands/entities/brand.entity';
import { Category } from '../../../categories/entities/category.entity';
import { Product } from '../../../products/entities/product.entity';
import { productsSeedData } from '../data/products.seed-data';
import { Seeder } from './seeder.interface';

@Injectable()
export class ProductsSeeder implements Seeder {
  async seed(manager: EntityManager): Promise<void> {
    const brandRepository = manager.getRepository(Brand);
    const categoryRepository = manager.getRepository(Category);
    const productRepository = manager.getRepository(Product);

    for (const productData of productsSeedData) {
      const brand = await brandRepository.findOneBy({
        slug: productData.brandSlug,
      });
      const category = await categoryRepository.findOneBy({
        slug: productData.categorySlug,
      });
      if (!brand || !category) {
        throw new Error(`Seed product references missing brand or category`);
      }

      await productRepository.upsert(
        {
          brandId: brand.id,
          categoryId: category.id,
          name: productData.name,
          slug: productData.slug,
          model: productData.model,
          description: productData.description,
        },
        {
          conflictPaths: ['slug'],
          indexPredicate: 'deleted_at IS NULL',
          skipUpdateIfNoValuesChanged: true,
        },
      );
    }
  }
}
