import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Attribute } from '../../../attributes/entities/attribute.entity';
import { CategoryAttribute } from '../../../categories/entities/category-attribute.entity';
import { Category } from '../../../categories/entities/category.entity';
import { categoryAttributesSeedData } from '../data/category-attributes.seed-data';
import { Seeder } from './seeder.interface';

@Injectable()
export class CategoryAttributesSeeder implements Seeder {
  async seed(manager: EntityManager): Promise<void> {
    const categoryRepository = manager.getRepository(Category);
    const attributeRepository = manager.getRepository(Attribute);
    const categoryAttributeRepository =
      manager.getRepository(CategoryAttribute);

    for (const categoryAttributeData of categoryAttributesSeedData) {
      const category = await categoryRepository.findOneBy({
        slug: categoryAttributeData.categorySlug,
      });
      const attribute = await attributeRepository.findOneBy({
        slug: categoryAttributeData.attributeSlug,
      });
      if (!category || !attribute) {
        throw new Error(
          `Seed category attribute references missing category or attribute`,
        );
      }

      await categoryAttributeRepository.upsert(
        {
          categoryId: category.id,
          attributeId: attribute.id,
          position: categoryAttributeData.position,
        },
        {
          conflictPaths: ['categoryId', 'attributeId'],
          indexPredicate: 'deleted_at IS NULL',
          skipUpdateIfNoValuesChanged: true,
        },
      );
    }
  }
}
