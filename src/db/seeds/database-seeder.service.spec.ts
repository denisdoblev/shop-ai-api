import { DataSource, EntityManager } from 'typeorm';
import { DatabaseSeederService } from './database-seeder.service';
import { AttributesSeeder } from './seeders/attributes.seeder';
import { BrandsSeeder } from './seeders/brands.seeder';
import { CategoriesSeeder } from './seeders/categories.seeder';
import { CategoryAttributesSeeder } from './seeders/category-attributes.seeder';
import { ProductImagesSeeder } from './seeders/product-images.seeder';
import { ProductPricesSeeder } from './seeders/product-prices.seeder';
import { ProductsSeeder } from './seeders/products.seeder';
import { ProductSpecificationsSeeder } from './seeders/product-specifications.seeder';
import { UsersSeeder } from './seeders/users.seeder';
import { Seeder } from './seeders/seeder.interface';

describe('DatabaseSeederService', () => {
  const manager = {} as EntityManager;
  const mockSeeders = Array.from({ length: 9 }, () => ({
    seed: jest.fn<Promise<void>, [EntityManager]>(),
  }));
  const seeders: Seeder[] = mockSeeders;
  const showMigrations = jest.fn<Promise<boolean>, []>();
  const transaction = jest.fn();
  const dataSource = {
    showMigrations,
    transaction,
  } as unknown as DataSource;

  const createService = (): DatabaseSeederService =>
    new DatabaseSeederService(
      dataSource,
      seeders[0] as BrandsSeeder,
      seeders[1] as CategoriesSeeder,
      seeders[2] as AttributesSeeder,
      seeders[3] as CategoryAttributesSeeder,
      seeders[4] as ProductsSeeder,
      seeders[5] as ProductSpecificationsSeeder,
      seeders[6] as ProductImagesSeeder,
      seeders[7] as ProductPricesSeeder,
      seeders[8] as UsersSeeder,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    showMigrations.mockResolvedValue(false);
    transaction.mockImplementation(
      async (callback: (transactionManager: EntityManager) => Promise<void>) =>
        await callback(manager),
    );
  });

  it('runs every seeder in dependency order with one transaction manager', async () => {
    const service = createService();

    await service.seed();

    expect(transaction).toHaveBeenCalledTimes(1);
    for (const seeder of mockSeeders) {
      expect(seeder.seed.mock.calls).toEqual([[manager]]);
    }
    const invocationOrder = mockSeeders.map(
      (seeder) => seeder.seed.mock.invocationCallOrder[0],
    );
    for (let index = 1; index < invocationOrder.length; index += 1) {
      expect(invocationOrder[index]).toBeGreaterThan(
        invocationOrder[index - 1],
      );
    }
  });

  it('fails before opening a transaction when migrations are pending', async () => {
    showMigrations.mockResolvedValue(true);

    await expect(createService().seed()).rejects.toThrow('pending migrations');

    expect(transaction).not.toHaveBeenCalled();
  });

  it('propagates a seeder failure and stops later seeders', async () => {
    const failure = new Error('seed failed');
    mockSeeders[3].seed.mockRejectedValueOnce(failure);

    await expect(createService().seed()).rejects.toThrow(failure);

    expect(mockSeeders[4].seed.mock.calls).toHaveLength(0);
  });
});
