import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Attribute } from '../../attributes/entities/attribute.entity';
import { Category } from '../entities/category.entity';
import { CategoryAttribute } from '../entities/category-attribute.entity';
import {
  CategoryAttributeResponseDto,
  CreateCategoryAttributeDto,
} from './dto';

interface PostgresError {
  code?: string;
  constraint?: string;
}

@Injectable()
export class CategoryAttributesService {
  constructor(
    @InjectRepository(CategoryAttribute)
    private readonly categoryAttributeRepository: Repository<CategoryAttribute>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Attribute)
    private readonly attributeRepository: Repository<Attribute>,
  ) {}

  async findAll(categoryId: string): Promise<CategoryAttributeResponseDto[]> {
    await this.ensureCategory(categoryId);
    const categoryAttributes = await this.categoryAttributeRepository.find({
      where: { categoryId },
      relations: { attribute: true },
      order: { position: 'ASC', id: 'ASC' },
    });

    return categoryAttributes.map((categoryAttribute) =>
      this.toResponse(categoryAttribute),
    );
  }

  async create(
    categoryId: string,
    createCategoryAttributeDto: CreateCategoryAttributeDto,
  ): Promise<CategoryAttributeResponseDto> {
    await this.ensureCategory(categoryId);
    const attribute = await this.ensureAttribute(
      createCategoryAttributeDto.attributeId,
    );
    const categoryAttribute = this.categoryAttributeRepository.create({
      categoryId,
      attributeId: createCategoryAttributeDto.attributeId,
      position: createCategoryAttributeDto.position ?? 0,
    });

    try {
      return this.toResponse(
        await this.categoryAttributeRepository.save(categoryAttribute),
        attribute.name,
      );
    } catch (error: unknown) {
      this.throwIfActivePairConflict(error);
      throw error;
    }
  }

  async remove(categoryId: string, attributeId: string): Promise<void> {
    await this.ensureCategory(categoryId);
    const categoryAttribute = await this.categoryAttributeRepository.findOneBy({
      categoryId,
      attributeId,
    });
    if (!categoryAttribute) {
      throw new NotFoundException('Category attribute association not found');
    }

    await this.categoryAttributeRepository.softRemove(categoryAttribute);
  }

  private async ensureCategory(categoryId: string): Promise<void> {
    const category = await this.categoryRepository.findOneBy({
      id: categoryId,
    });
    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found`);
    }
  }

  private async ensureAttribute(attributeId: string): Promise<Attribute> {
    const attribute = await this.attributeRepository.findOneBy({
      id: attributeId,
    });
    if (!attribute) {
      throw new NotFoundException(`Attribute with id ${attributeId} not found`);
    }

    return attribute;
  }

  private toResponse(
    categoryAttribute: CategoryAttribute,
    attributeName = categoryAttribute.attribute.name,
  ): CategoryAttributeResponseDto {
    return {
      id: categoryAttribute.id,
      attributeId: categoryAttribute.attributeId,
      name: attributeName,
      position: categoryAttribute.position,
      createdAt: categoryAttribute.createdAt,
      updatedAt: categoryAttribute.updatedAt,
    };
  }

  private throwIfActivePairConflict(error: unknown): void {
    if (!(error instanceof QueryFailedError)) return;

    const driverError = error.driverError as PostgresError;
    if (
      driverError.code === '23505' &&
      driverError.constraint === 'uq_category_attribute_active'
    ) {
      throw new ConflictException(
        'This attribute is already active for the category',
      );
    }
  }
}
