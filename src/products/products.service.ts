import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsWhere,
  QueryFailedError,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Brand } from '../brands/entities/brand.entity';
import { Category } from '../categories/entities/category.entity';
import {
  CreateProductDto,
  ProductQueryDto,
  ProductResponseDto,
  UpdateProductDto,
} from './dto';
import { Product } from './entities/product.entity';
import { ProductSpecification } from './entities/product-specification.entity';

interface PostgresError {
  code?: string;
  constraint?: string;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(
    createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    await this.ensureReferences(
      createProductDto.brandId,
      createProductDto.categoryId,
    );
    const product = this.productRepository.create(createProductDto);

    try {
      return this.toResponse(await this.productRepository.save(product));
    } catch (error: unknown) {
      this.throwIfSlugConflict(error);
      throw error;
    }
  }

  async findAll(query: ProductQueryDto): Promise<ProductResponseDto[]> {
    this.validateSpecificationFilters(query);

    if (this.hasSpecificationValueFilter(query) && !query.specAttributeId) {
      throw new BadRequestException(
        'specAttributeId is required when filtering by a specification value',
      );
    }

    const where: FindOptionsWhere<Product> = {};
    if (query.brandId) where.brandId = query.brandId;
    if (query.categoryId) where.categoryId = query.categoryId;

    if (!query.specAttributeId) {
      const products = await this.productRepository.find({
        where,
        take: query.limit,
        skip: query.offset,
        order: { name: 'ASC', id: 'ASC' },
      });

      return products.map((product) => this.toResponse(product));
    }

    const queryBuilder = this.applySpecificationFilter(
      this.productRepository
        .createQueryBuilder('product')
        .innerJoin(
          ProductSpecification,
          'specification',
          'specification.product_id = product.id AND specification.deleted_at IS NULL',
        )
        .where('specification.attribute_id = :specAttributeId', {
          specAttributeId: query.specAttributeId,
        }),
      query,
    );
    if (query.brandId) {
      queryBuilder.andWhere('product.brand_id = :brandId', {
        brandId: query.brandId,
      });
    }
    if (query.categoryId) {
      queryBuilder.andWhere('product.category_id = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    const products = await queryBuilder
      .orderBy('product.name', 'ASC')
      .addOrderBy('product.id', 'ASC')
      .take(query.limit)
      .skip(query.offset)
      .getMany();

    return products.map((product) => this.toResponse(product));
  }

  private applySpecificationFilter(
    queryBuilder: SelectQueryBuilder<Product>,
    query: ProductQueryDto,
  ): SelectQueryBuilder<Product> {
    if (query.specStringValue !== undefined) {
      queryBuilder.andWhere('specification.string_value = :specStringValue', {
        specStringValue: query.specStringValue,
      });
    }
    if (query.specNumberMin !== undefined) {
      queryBuilder.andWhere('specification.numeric_value >= :specNumberMin', {
        specNumberMin: query.specNumberMin,
      });
    }
    if (query.specNumberMax !== undefined) {
      queryBuilder.andWhere('specification.numeric_value <= :specNumberMax', {
        specNumberMax: query.specNumberMax,
      });
    }
    if (query.specBooleanValue !== undefined) {
      queryBuilder.andWhere('specification.boolean_value = :specBooleanValue', {
        specBooleanValue: query.specBooleanValue,
      });
    }

    return queryBuilder;
  }

  private hasSpecificationValueFilter(query: ProductQueryDto): boolean {
    return (
      query.specStringValue !== undefined ||
      query.specNumberMin !== undefined ||
      query.specNumberMax !== undefined ||
      query.specBooleanValue !== undefined
    );
  }

  private validateSpecificationFilters(query: ProductQueryDto): void {
    const filterTypeCount = [
      query.specStringValue !== undefined,
      query.specNumberMin !== undefined || query.specNumberMax !== undefined,
      query.specBooleanValue !== undefined,
    ].filter(Boolean).length;

    if (filterTypeCount > 1) {
      throw new BadRequestException(
        'Specification filters must use only one value type',
      );
    }

    if (
      query.specNumberMin !== undefined &&
      query.specNumberMax !== undefined &&
      query.specNumberMin > query.specNumberMax
    ) {
      throw new BadRequestException(
        'specNumberMin must be less than or equal to specNumberMax',
      );
    }
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    return this.toResponse(await this.findEntity(id));
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.findEntity(id);
    await this.ensureReferences(
      updateProductDto.brandId,
      updateProductDto.categoryId,
    );
    this.productRepository.merge(product, updateProductDto);

    try {
      return this.toResponse(await this.productRepository.save(product));
    } catch (error: unknown) {
      this.throwIfSlugConflict(error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.productRepository.softRemove(await this.findEntity(id));
  }

  private async findEntity(id: string): Promise<Product> {
    const product = await this.productRepository.findOneBy({ id });
    if (!product)
      throw new NotFoundException(`Product with id ${id} not found`);

    return product;
  }

  private async ensureReferences(
    brandId?: string,
    categoryId?: string,
  ): Promise<void> {
    if (brandId) {
      const brand = await this.brandRepository.findOneBy({ id: brandId });
      if (!brand)
        throw new NotFoundException(`Brand with id ${brandId} not found`);
    }

    if (categoryId) {
      const category = await this.categoryRepository.findOneBy({
        id: categoryId,
      });
      if (!category) {
        throw new NotFoundException(`Category with id ${categoryId} not found`);
      }
    }
  }

  private toResponse(product: Product): ProductResponseDto {
    return {
      id: product.id,
      brandId: product.brandId,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      model: product.model,
      description: product.description,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private throwIfSlugConflict(error: unknown): void {
    if (!(error instanceof QueryFailedError)) return;

    const driverError = error.driverError as PostgresError;
    if (
      driverError.code === '23505' &&
      driverError.constraint === 'uq_products_slug_active'
    ) {
      throw new ConflictException(
        'An active product with that slug already exists',
      );
    }
  }
}
