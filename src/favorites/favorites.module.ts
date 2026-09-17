import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/entities/product.entity';
import { ProductFavorite } from './entities/product-favorite.entity';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductFavorite, Product])],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
