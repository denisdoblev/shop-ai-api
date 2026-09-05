import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import {
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto';
import { Category } from './entities/category.entity';
import { CategoryAttribute } from './entities/category-attribute.entity';

interface PostgresError {
  code?: string;
  constraint?: string;
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(CategoryAttribute)
    private readonly categoryAttributeRepository: Repository<CategoryAttribute>,
  ) {}

  async create(
    createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    await this.ensureActiveParent(createCategoryDto.parentId);
    const category = this.categoryRepository.create(createCategoryDto);

    try {
      return this.toResponse(await this.categoryRepository.save(category));
    } catch (error: unknown) {
      this.throwKnownPersistenceError(error);
      throw error;
    }
  }

  async findAll(limit: number, offset: number): Promise<CategoryResponseDto[]> {
    const categories = await this.categoryRepository.find({
      take: limit,
      skip: offset,
      order: { name: 'ASC', id: 'ASC' },
    });

    return categories.map((category) => this.toResponse(category));
  }

  async findOne(id: string): Promise<CategoryResponseDto> {
    return this.toResponse(await this.findEntity(id));
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.findEntity(id);

    if (updateCategoryDto.parentId === id) {
      throw new BadRequestException('A category cannot be its own parent');
    }

    await this.ensureActiveParent(updateCategoryDto.parentId);
    await this.ensureNoParentCycle(id, updateCategoryDto.parentId);
    this.categoryRepository.merge(category, updateCategoryDto);

    try {
      return this.toResponse(await this.categoryRepository.save(category));
    } catch (error: unknown) {
      this.throwKnownPersistenceError(error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const category = await this.findEntity(id);
    const [hasProducts, hasChildren, hasAttributes] = await Promise.all([
      this.productRepository.existsBy({ categoryId: id }),
      this.categoryRepository.existsBy({ parentId: id }),
      this.categoryAttributeRepository.existsBy({ categoryId: id }),
    ]);

    if (hasProducts || hasChildren || hasAttributes) {
      throw new ConflictException(
        'Category cannot be deleted while it has active products, children, or attribute associations',
      );
    }

    await this.categoryRepository.softRemove(category);
  }

  private async findEntity(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOneBy({ id });

    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }

    return category;
  }

  private async ensureActiveParent(parentId?: string | null): Promise<void> {
    if (parentId === undefined || parentId === null) return;

    const parent = await this.categoryRepository.findOneBy({ id: parentId });
    if (!parent) {
      throw new NotFoundException(
        `Parent category with id ${parentId} not found`,
      );
    }
  }

  private async ensureNoParentCycle(
    categoryId: string,
    parentId?: string | null,
  ): Promise<void> {
    if (parentId === undefined || parentId === null) return;

    const visited = new Set<string>();
    let ancestorId: string | null = parentId;

    while (ancestorId !== null) {
      if (ancestorId === categoryId || visited.has(ancestorId)) {
        throw new BadRequestException(
          'Category parent assignment would create a cycle',
        );
      }

      visited.add(ancestorId);
      const ancestor = await this.categoryRepository.findOneBy({
        id: ancestorId,
      });
      ancestorId = ancestor?.parentId ?? null;
    }
  }

  private toResponse(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      slug: category.slug,
      description: category.description,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private throwKnownPersistenceError(error: unknown): void {
    if (!(error instanceof QueryFailedError)) return;

    const driverError = error.driverError as PostgresError;
    if (
      driverError.code === '23505' &&
      driverError.constraint === 'uq_categories_slug_active'
    ) {
      throw new ConflictException(
        'An active category with that slug already exists',
      );
    }

    if (
      driverError.code === '23514' &&
      driverError.constraint === 'chk_categories_not_self_parent'
    ) {
      throw new BadRequestException('A category cannot be its own parent');
    }
  }
}
