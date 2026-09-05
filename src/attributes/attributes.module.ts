import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryAttribute } from '../categories/entities/category-attribute.entity';
import { ProductSpecification } from '../products/entities/product-specification.entity';
import { AttributesController } from './attributes.controller';
import { AttributesService } from './attributes.service';
import { Attribute } from './entities/attribute.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Attribute,
      CategoryAttribute,
      ProductSpecification,
    ]),
  ],
  controllers: [AttributesController],
  providers: [AttributesService],
})
export class AttributesModule {}
