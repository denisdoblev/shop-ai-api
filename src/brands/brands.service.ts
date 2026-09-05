import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { BrandResponseDto, CreateBrandDto, UpdateBrandDto } from './dto';
import { Brand } from './entities/brand.entity';

interface PostgresError {
  code?: string;
  constraint?: string;
}

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(createBrandDto: CreateBrandDto): Promise<BrandResponseDto> {
    const brand = this.brandRepository.create(createBrandDto);

    try {
      return this.toResponse(await this.brandRepository.save(brand));
    } catch (error: unknown) {
      this.throwIfSlugConflict(error);
      throw error;
    }
  }

  async findAll(limit: number, offset: number): Promise<BrandResponseDto[]> {
    const brands = await this.brandRepository.find({
      take: limit,
      skip: offset,
      order: { name: 'ASC', id: 'ASC' },
    });

    return brands.map((brand) => this.toResponse(brand));
  }

  async findOne(id: string): Promise<BrandResponseDto> {
    return this.toResponse(await this.findEntity(id));
  }

  async update(
    id: string,
    updateBrandDto: UpdateBrandDto,
  ): Promise<BrandResponseDto> {
    const brand = await this.findEntity(id);
    this.brandRepository.merge(brand, updateBrandDto);

    try {
      return this.toResponse(await this.brandRepository.save(brand));
    } catch (error: unknown) {
      this.throwIfSlugConflict(error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const brand = await this.findEntity(id);

    if (await this.productRepository.existsBy({ brandId: id })) {
      throw new ConflictException(
        'Brand cannot be deleted while it has active products',
      );
    }

    await this.brandRepository.softRemove(brand);
  }

  private async findEntity(id: string): Promise<Brand> {
    const brand = await this.brandRepository.findOneBy({ id });

    if (!brand) {
      throw new NotFoundException(`Brand with id ${id} not found`);
    }

    return brand;
  }

  private toResponse(brand: Brand): BrandResponseDto {
    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  }

  private throwIfSlugConflict(error: unknown): void {
    if (!(error instanceof QueryFailedError)) return;

    const driverError = error.driverError as PostgresError;
    if (
      driverError.code === '23505' &&
      driverError.constraint === 'uq_brands_slug_active'
    ) {
      throw new ConflictException(
        'An active brand with that slug already exists',
      );
    }
  }
}
