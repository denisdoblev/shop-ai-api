import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { Attribute } from '../src/attributes/entities/attribute.entity';
import { Brand } from '../src/brands/entities/brand.entity';
import { CategoryAttribute } from '../src/categories/entities/category-attribute.entity';
import { Category } from '../src/categories/entities/category.entity';
import { DatabaseSeederService } from '../src/db/seeds/database-seeder.service';
import { SeedsModule } from '../src/db/seeds/seeds.module';
import { ProductsSeeder } from '../src/db/seeds/seeders/products.seeder';
import { ProductImage } from '../src/products/entities/product-image.entity';
import { ProductPrice } from '../src/products/entities/product-price.entity';
import { ProductSpecification } from '../src/products/entities/product-specification.entity';
import { Product } from '../src/products/entities/product.entity';
import { clearDatabase, closeTestDatabase } from './test-utils';

describe('Database seeding (e2e)', () => {
  let app: INestApplicationContext | undefined;

  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    await clearDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('seeds deterministic catalog data without duplicating active records', async () => {
    app = await NestFactory.createApplicationContext(SeedsModule);
    const seeder = app.get(DatabaseSeederService);
    const dataSource = app.get(DataSource);

    await seeder.seed();
    await seeder.seed();

    await expect(dataSource.getRepository(Brand).count()).resolves.toBe(3);
    await expect(dataSource.getRepository(Category).count()).resolves.toBe(2);
    await expect(dataSource.getRepository(Attribute).count()).resolves.toBe(5);
    await expect(
      dataSource.getRepository(CategoryAttribute).count(),
    ).resolves.toBe(5);
    await expect(dataSource.getRepository(Product).count()).resolves.toBe(3);
    await expect(
      dataSource.getRepository(ProductSpecification).count(),
    ).resolves.toBe(15);
    await expect(dataSource.getRepository(ProductImage).count()).resolves.toBe(
      6,
    );
    await expect(dataSource.getRepository(ProductPrice).count()).resolves.toBe(
      6,
    );

    const headphones = await dataSource.getRepository(Category).findOneBy({
      slug: 'headphones',
    });
    const sony = await dataSource.getRepository(Product).findOneBy({
      slug: 'sony-wh-1000xm6',
    });

    expect(headphones?.parentId).toEqual(expect.any(String));
    expect(sony?.categoryId).toBe(headphones?.id);
  });

  it('rolls back all writes when a later seeder fails', async () => {
    const failingProductsSeeder = {
      seed: jest
        .fn<Promise<void>, []>()
        .mockRejectedValue(new Error('seed failed')),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SeedsModule],
    })
      .overrideProvider(ProductsSeeder)
      .useValue(failingProductsSeeder)
      .compile();
    await moduleFixture.init();
    app = moduleFixture;

    const seeder = app.get(DatabaseSeederService);
    const dataSource = app.get(DataSource);

    await expect(seeder.seed()).rejects.toThrow('seed failed');
    await expect(dataSource.getRepository(Brand).count()).resolves.toBe(0);
    await expect(dataSource.getRepository(Category).count()).resolves.toBe(0);
    await expect(dataSource.getRepository(Attribute).count()).resolves.toBe(0);
  });
});
