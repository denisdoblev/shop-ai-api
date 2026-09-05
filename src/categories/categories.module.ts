import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attribute } from '../attributes/entities/attribute.entity';
import { Product } from '../products/entities/product.entity';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { CategoryAttribute } from './entities/category-attribute.entity';
import { CategoryAttributesController } from './category-attributes/category-attributes.controller';
import { CategoryAttributesService } from './category-attributes/category-attributes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category, Attribute, CategoryAttribute, Product]),
  ],
  controllers: [CategoriesController, CategoryAttributesController],
  providers: [CategoriesService, CategoryAttributesService],
})
export class CategoriesModule {}
