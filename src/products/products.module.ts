import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attribute } from '../attributes/entities/attribute.entity';
import { Brand } from '../brands/entities/brand.entity';
import { Category } from '../categories/entities/category.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductSpecification } from './entities/product-specification.entity';
import { ProductImagesController } from './product-images/product-images.controller';
import { ProductImagesService } from './product-images/product-images.service';
import { ProductSpecificationsController } from './product-specifications/product-specifications.controller';
import { ProductSpecificationsService } from './product-specifications/product-specifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductImage,
      ProductSpecification,
      Brand,
      Category,
      Attribute,
    ]),
  ],
  controllers: [
    ProductsController,
    ProductImagesController,
    ProductSpecificationsController,
  ],
  providers: [
    ProductsService,
    ProductImagesService,
    ProductSpecificationsService,
  ],
})
export class ProductsModule {}
