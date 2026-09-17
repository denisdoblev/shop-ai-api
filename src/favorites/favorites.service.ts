import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { FavoriteResponseDto } from './dto/favorite-response.dto';
import { ProductFavorite } from './entities/product-favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(ProductFavorite)
    private readonly favoriteRepository: Repository<ProductFavorite>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(
    userId: string,
    productId?: string,
  ): Promise<FavoriteResponseDto[]> {
    const query = this.favoriteRepository
      .createQueryBuilder('favorite')
      .innerJoin(
        Product,
        'product',
        'product.id = favorite.product_id AND product.deleted_at IS NULL',
      )
      .where('favorite.user_id = :userId', { userId })
      .orderBy('favorite.created_at', 'DESC')
      .addOrderBy('favorite.id', 'DESC');

    if (productId)
      query.andWhere('favorite.product_id = :productId', { productId });

    return (await query.getMany()).map((favorite) => this.toResponse(favorite));
  }

  async put(userId: string, productId: string): Promise<FavoriteResponseDto> {
    await this.ensureProductExists(productId);

    const existing = await this.favoriteRepository.findOne({
      where: { userId, productId },
      withDeleted: true,
      order: { createdAt: 'DESC' },
    });

    if (!existing) {
      const favorite = this.favoriteRepository.create({ userId, productId });
      return this.toResponse(await this.favoriteRepository.save(favorite));
    }

    if (existing.deletedAt) {
      await this.favoriteRepository.restore(existing.id);
      const restored = await this.favoriteRepository.findOneBy({
        id: existing.id,
      });
      if (!restored)
        throw new NotFoundException('Favorite could not be restored');
      return this.toResponse(restored);
    }

    return this.toResponse(existing);
  }

  async remove(userId: string, productId: string): Promise<void> {
    const favorite = await this.favoriteRepository.findOneBy({
      userId,
      productId,
    });
    if (favorite) await this.favoriteRepository.softRemove(favorite);
  }

  private async ensureProductExists(productId: string): Promise<void> {
    if (!(await this.productRepository.existsBy({ id: productId }))) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }
  }

  private toResponse(favorite: ProductFavorite): FavoriteResponseDto {
    return {
      id: favorite.id,
      productId: favorite.productId,
      createdAt: favorite.createdAt,
      updatedAt: favorite.updatedAt,
    };
  }
}
