import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from 'typeorm';
import { CategoryAttribute } from '../categories/entities/category-attribute.entity';
import { ProductSpecification } from '../products/entities/product-specification.entity';
import {
  AttributeQueryDto,
  AttributeResponseDto,
  CreateAttributeDto,
  UpdateAttributeDto,
} from './dto';
import { Attribute } from './entities/attribute.entity';

interface PostgresError {
  code?: string;
  constraint?: string;
}

@Injectable()
export class AttributesService {
  constructor(
    @InjectRepository(Attribute)
    private readonly attributeRepository: Repository<Attribute>,
    @InjectRepository(CategoryAttribute)
    private readonly categoryAttributeRepository: Repository<CategoryAttribute>,
    @InjectRepository(ProductSpecification)
    private readonly productSpecificationRepository: Repository<ProductSpecification>,
  ) {}

  async create(
    createAttributeDto: CreateAttributeDto,
  ): Promise<AttributeResponseDto> {
    const attribute = this.attributeRepository.create(createAttributeDto);

    try {
      return this.toResponse(await this.attributeRepository.save(attribute));
    } catch (error: unknown) {
      this.throwIfSlugConflict(error);
      throw error;
    }
  }

  async findAll(query: AttributeQueryDto): Promise<AttributeResponseDto[]> {
    const where: FindOptionsWhere<Attribute> = {};
    if (query.name !== undefined) {
      where.name = ILike(`%${query.name}%`);
    }

    const attributes = await this.attributeRepository.find({
      where,
      take: query.limit,
      skip: query.offset,
      order: { name: 'ASC', id: 'ASC' },
    });

    return attributes.map((attribute) => this.toResponse(attribute));
  }

  async findOne(id: string): Promise<AttributeResponseDto> {
    return this.toResponse(await this.findEntity(id));
  }

  async update(
    id: string,
    updateAttributeDto: UpdateAttributeDto,
  ): Promise<AttributeResponseDto> {
    const attribute = await this.findEntity(id);

    if (
      updateAttributeDto.dataType !== undefined &&
      updateAttributeDto.dataType !== attribute.dataType &&
      (await this.productSpecificationRepository.existsBy({ attributeId: id }))
    ) {
      throw new ConflictException(
        'Attribute data type cannot be changed while product specifications exist',
      );
    }

    this.attributeRepository.merge(attribute, updateAttributeDto);

    try {
      return this.toResponse(await this.attributeRepository.save(attribute));
    } catch (error: unknown) {
      this.throwIfSlugConflict(error);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const attribute = await this.findEntity(id);
    const [hasCategoryAssociations, hasProductSpecifications] =
      await Promise.all([
        this.categoryAttributeRepository.existsBy({ attributeId: id }),
        this.productSpecificationRepository.existsBy({ attributeId: id }),
      ]);

    if (hasCategoryAssociations || hasProductSpecifications) {
      throw new ConflictException(
        'Attribute cannot be deleted while it has active category associations or product specifications',
      );
    }

    await this.attributeRepository.softRemove(attribute);
  }

  private async findEntity(id: string): Promise<Attribute> {
    const attribute = await this.attributeRepository.findOneBy({ id });

    if (!attribute) {
      throw new NotFoundException(`Attribute with id ${id} not found`);
    }

    return attribute;
  }

  private toResponse(attribute: Attribute): AttributeResponseDto {
    return {
      id: attribute.id,
      name: attribute.name,
      slug: attribute.slug,
      dataType: attribute.dataType,
      unit: attribute.unit,
      createdAt: attribute.createdAt,
      updatedAt: attribute.updatedAt,
    };
  }

  private throwIfSlugConflict(error: unknown): void {
    if (!(error instanceof QueryFailedError)) return;

    const driverError = error.driverError as PostgresError;
    if (
      driverError.code === '23505' &&
      driverError.constraint === 'uq_attributes_slug_active'
    ) {
      throw new ConflictException(
        'An active attribute with that slug already exists',
      );
    }
  }
}
