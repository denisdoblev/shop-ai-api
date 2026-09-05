import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AttributesSeeder } from './seeders/attributes.seeder';
import { BrandsSeeder } from './seeders/brands.seeder';
import { CategoriesSeeder } from './seeders/categories.seeder';
import { CategoryAttributesSeeder } from './seeders/category-attributes.seeder';
import { ProductImagesSeeder } from './seeders/product-images.seeder';
import { ProductPricesSeeder } from './seeders/product-prices.seeder';
import { ProductsSeeder } from './seeders/products.seeder';
import { ProductSpecificationsSeeder } from './seeders/product-specifications.seeder';
import { Seeder } from './seeders/seeder.interface';

@Injectable()
export class DatabaseSeederService {
  private readonly logger = new Logger(DatabaseSeederService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly brandsSeeder: BrandsSeeder,
    private readonly categoriesSeeder: CategoriesSeeder,
    private readonly attributesSeeder: AttributesSeeder,
    private readonly categoryAttributesSeeder: CategoryAttributesSeeder,
    private readonly productsSeeder: ProductsSeeder,
    private readonly productSpecificationsSeeder: ProductSpecificationsSeeder,
    private readonly productImagesSeeder: ProductImagesSeeder,
    private readonly productPricesSeeder: ProductPricesSeeder,
  ) {}

  async seed(): Promise<void> {
    if (await this.dataSource.showMigrations()) {
      throw new Error(
        'Database has pending migrations. Run pnpm run migration:run before seeding.',
      );
    }

    const startedAt = Date.now();
    this.logger.log('Starting database seed');

    await this.dataSource.transaction(async (manager) => {
      for (const seeder of this.seeders) {
        await this.runSeeder(seeder, manager);
      }
    });

    this.logger.log(`Database seed completed in ${Date.now() - startedAt}ms`);
  }

  private get seeders(): readonly Seeder[] {
    return [
      this.brandsSeeder,
      this.categoriesSeeder,
      this.attributesSeeder,
      this.categoryAttributesSeeder,
      this.productsSeeder,
      this.productSpecificationsSeeder,
      this.productImagesSeeder,
      this.productPricesSeeder,
    ];
  }

  private async runSeeder(
    seeder: Seeder,
    manager: EntityManager,
  ): Promise<void> {
    this.logger.log(`Running ${seeder.constructor.name}`);
    await seeder.seed(manager);
  }
}
