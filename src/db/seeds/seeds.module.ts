import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attribute } from '../../attributes/entities/attribute.entity';
import { Brand } from '../../brands/entities/brand.entity';
import { CategoryAttribute } from '../../categories/entities/category-attribute.entity';
import { Category } from '../../categories/entities/category.entity';
import { seedEnvValidationSchema, typeOrmConfigFactory } from '../../config';
import { ProductImage } from '../../products/entities/product-image.entity';
import { ProductPrice } from '../../products/entities/product-price.entity';
import { ProductSpecification } from '../../products/entities/product-specification.entity';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../auth/entities/user.entity';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: seedEnvValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: typeOrmConfigFactory,
    }),
    TypeOrmModule.forFeature([
      Brand,
      Category,
      Attribute,
      CategoryAttribute,
      Product,
      ProductSpecification,
      ProductImage,
      ProductPrice,
      User,
    ]),
  ],
  providers: [
    DatabaseSeederService,
    BrandsSeeder,
    CategoriesSeeder,
    AttributesSeeder,
    CategoryAttributesSeeder,
    ProductsSeeder,
    ProductSpecificationsSeeder,
    ProductImagesSeeder,
    ProductPricesSeeder,
    UsersSeeder,
  ],
})
export class SeedsModule {}
