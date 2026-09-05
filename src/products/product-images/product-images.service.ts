import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductImage } from '../entities/product-image.entity';
import { CreateProductImageDto, ProductImageResponseDto } from './dto';

interface PostgresError {
  code?: string;
  constraint?: string;
}

@Injectable()
export class ProductImagesService {
  constructor(
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(productId: string): Promise<ProductImageResponseDto[]> {
    await this.ensureProduct(productId);
    const images = await this.productImageRepository.find({
      where: { productId },
      order: { position: 'ASC', id: 'ASC' },
    });

    return images.map((image) => this.toResponse(image));
  }

  async create(
    productId: string,
    createProductImageDto: CreateProductImageDto,
  ): Promise<ProductImageResponseDto> {
    await this.ensureProduct(productId);
    const image = this.productImageRepository.create({
      productId,
      url: createProductImageDto.url,
      altText: createProductImageDto.altText,
      position: createProductImageDto.position ?? 0,
    });

    try {
      return this.toResponse(await this.productImageRepository.save(image));
    } catch (error: unknown) {
      this.throwIfPositionConflict(error);
      throw error;
    }
  }

  private async ensureProduct(productId: string): Promise<void> {
    const product = await this.productRepository.findOneBy({ id: productId });
    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }
  }

  private toResponse(image: ProductImage): ProductImageResponseDto {
    return {
      id: image.id,
      productId: image.productId,
      url: image.url,
      altText: image.altText,
      position: image.position,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    };
  }

  private throwIfPositionConflict(error: unknown): void {
    if (!(error instanceof QueryFailedError)) return;

    const driverError = error.driverError as PostgresError;
    if (
      driverError.code === '23505' &&
      driverError.constraint === 'uq_product_image_position_active'
    ) {
      throw new ConflictException('An active image already uses that position');
    }
  }
}
