import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Category } from '../../../categories/entities/category.entity';
import { categoriesSeedData } from '../data/categories.seed-data';
import { Seeder } from './seeder.interface';

@Injectable()
export class CategoriesSeeder implements Seeder {
  async seed(manager: EntityManager): Promise<void> {
    const repository = manager.getRepository(Category);
    const rootCategories = categoriesSeedData.filter(
      (category) => category.parentSlug === null,
    );

    await repository.upsert(
      rootCategories.map((category) => ({
        name: category.name,
        slug: category.slug,
        description: category.description,
      })),
      {
        conflictPaths: ['slug'],
        indexPredicate: 'deleted_at IS NULL',
        skipUpdateIfNoValuesChanged: true,
      },
    );

    for (const categoryData of categoriesSeedData) {
      if (categoryData.parentSlug === null) continue;

      const parent = await repository.findOneBy({
        slug: categoryData.parentSlug,
      });
      if (!parent) {
        throw new Error(
          `Seed category parent "${categoryData.parentSlug}" was not found`,
        );
      }

      await repository.upsert(
        {
          name: categoryData.name,
          slug: categoryData.slug,
          description: categoryData.description,
          parentId: parent.id,
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
