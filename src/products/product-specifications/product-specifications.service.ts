import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AttributeDataType } from '../../attributes/entities/attribute-data-type.enum';
import { Attribute } from '../../attributes/entities/attribute.entity';
import { Product } from '../entities/product.entity';
import { ProductSpecification } from '../entities/product-specification.entity';
import {
  CreateProductSpecificationDto,
  ProductSpecificationResponseDto,
  UpdateProductSpecificationDto,
} from './dto';

interface PostgresError {
  code?: string;
  constraint?: string;
}

type SpecificationValues = Pick<
  ProductSpecification,
  'stringValue' | 'numericValue' | 'booleanValue'
>;

@Injectable()
export class ProductSpecificationsService {
  constructor(
    @InjectRepository(ProductSpecification)
    private readonly specificationRepository: Repository<ProductSpecification>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Attribute)
    private readonly attributeRepository: Repository<Attribute>,
  ) {}

  async findAll(productId: string): Promise<ProductSpecificationResponseDto[]> {
    await this.ensureProduct(productId);
    const specifications = await this.specificationRepository.find({
      where: { productId },
      order: { id: 'ASC' },
    });
    return specifications.map((specification) =>
      this.toResponse(specification),
    );
  }

  async create(
    productId: string,
    dto: CreateProductSpecificationDto,
  ): Promise<ProductSpecificationResponseDto> {
    await this.ensureProduct(productId);
    const attribute = await this.findAttribute(dto.attributeId);
    const specification = this.specificationRepository.create({
      productId,
      attributeId: dto.attributeId,
      ...this.toPersistenceValues(attribute.dataType, dto.value),
    });
    try {
      return this.toResponse(
        await this.specificationRepository.save(specification),
      );
    } catch (error: unknown) {
      this.throwIfPairConflict(error);
      throw error;
    }
  }

  async update(
    productId: string,
    attributeId: string,
    dto: UpdateProductSpecificationDto,
  ): Promise<ProductSpecificationResponseDto> {
    await this.ensureProduct(productId);
    const specification = await this.specificationRepository.findOneBy({
      productId,
      attributeId,
    });
    if (!specification)
      throw new NotFoundException('Product specification not found');
    const attribute = await this.findAttribute(attributeId);
    this.specificationRepository.merge(
      specification,
      this.toPersistenceValues(attribute.dataType, dto.value),
    );
    return this.toResponse(
      await this.specificationRepository.save(specification),
    );
  }

  async remove(productId: string, attributeId: string): Promise<void> {
    await this.ensureProduct(productId);
    const specification = await this.specificationRepository.findOneBy({
      productId,
      attributeId,
    });
    if (!specification)
      throw new NotFoundException('Product specification not found');
    await this.specificationRepository.softRemove(specification);
  }

  private async ensureProduct(productId: string): Promise<void> {
    if (!(await this.productRepository.findOneBy({ id: productId }))) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }
  }
  private async findAttribute(attributeId: string): Promise<Attribute> {
    const attribute = await this.attributeRepository.findOneBy({
      id: attributeId,
    });
    if (!attribute)
      throw new NotFoundException(`Attribute with id ${attributeId} not found`);
    return attribute;
  }
  private toPersistenceValues(
    dataType: AttributeDataType,
    value: unknown,
  ): SpecificationValues {
    if (dataType === AttributeDataType.STRING) {
      if (typeof value !== 'string')
        throw new BadRequestException('Value must be a string');
      return { stringValue: value, numericValue: null, booleanValue: null };
    }
    if (dataType === AttributeDataType.NUMBER) {
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new BadRequestException('Value must be a finite number');
      return {
        stringValue: null,
        numericValue: value.toString(),
        booleanValue: null,
      };
    }
    if (typeof value !== 'boolean')
      throw new BadRequestException('Value must be a boolean');
    return { stringValue: null, numericValue: null, booleanValue: value };
  }
  private toResponse(
    specification: ProductSpecification,
  ): ProductSpecificationResponseDto {
    const value =
      specification.stringValue ??
      (specification.numericValue === null
        ? specification.booleanValue
        : Number(specification.numericValue));
    return {
      id: specification.id,
      productId: specification.productId,
      attributeId: specification.attributeId,
      value,
      createdAt: specification.createdAt,
      updatedAt: specification.updatedAt,
    };
  }
  private throwIfPairConflict(error: unknown): void {
    if (!(error instanceof QueryFailedError)) return;
    const driverError = error.driverError as PostgresError;
    if (
      driverError.code === '23505' &&
      driverError.constraint === 'uq_product_specification_active'
    ) {
      throw new ConflictException(
        'This attribute already has an active specification for the product',
      );
    }
  }
}
