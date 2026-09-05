import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductPrice } from '../entities/product-price.entity';
import { CreateProductPriceDto, ProductPriceResponseDto } from './dto';

interface PostgresError {
  code?: string;
  constraint?: string;
}

@Injectable()
export class ProductPricesService {
  constructor(
    @InjectRepository(ProductPrice)
    private readonly productPriceRepository: Repository<ProductPrice>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async findAll(productId: string): Promise<ProductPriceResponseDto[]> {
    await this.ensureProduct(productId);
    const prices = await this.productPriceRepository.find({
      where: { productId },
      order: { recordedAt: 'DESC', id: 'DESC' },
    });

    return prices.map((price) => this.toResponse(price));
  }

  async create(
    productId: string,
    createProductPriceDto: CreateProductPriceDto,
  ): Promise<ProductPriceResponseDto> {
    await this.ensureProduct(productId);
    const price = this.productPriceRepository.create({
      productId,
      price: createProductPriceDto.price.toFixed(2),
      currency: createProductPriceDto.currency,
      recordedAt: new Date(createProductPriceDto.recordedAt),
    });

    try {
      return this.toResponse(await this.productPriceRepository.save(price));
    } catch (error: unknown) {
      this.throwIfRecordedAtConflict(error);
      throw error;
    }
  }

  private async ensureProduct(productId: string): Promise<void> {
    const product = await this.productRepository.findOneBy({ id: productId });
    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }
  }

  private toResponse(price: ProductPrice): ProductPriceResponseDto {
    return {
      id: price.id,
      productId: price.productId,
      price: Number(price.price),
      currency: price.currency,
      recordedAt: price.recordedAt,
      createdAt: price.createdAt,
      updatedAt: price.updatedAt,
    };
  }

  private throwIfRecordedAtConflict(error: unknown): void {
    if (!(error instanceof QueryFailedError)) return;

    const driverError = error.driverError as PostgresError;
    if (
      driverError.code === '23505' &&
      driverError.constraint === 'uq_product_price_recorded_at_active'
    ) {
      throw new ConflictException(
        'An active price already exists for that recordedAt timestamp',
      );
    }
  }
}
