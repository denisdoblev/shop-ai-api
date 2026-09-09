import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ProductSpecificationsService } from './product-specifications.service';
import {
  CreateProductSpecificationDto,
  ProductSpecificationResponseDto,
  UpdateProductSpecificationDto,
} from './dto';
import { Auth } from '../../auth/decorators';
import { ValidRoles } from '../../auth/interfaces';

@ApiTags('products')
@Controller('products/:productId/specifications')
export class ProductSpecificationsController {
  constructor(
    private readonly productSpecificationsService: ProductSpecificationsService,
  ) {}
  @Get()
  @ApiOperation({ summary: 'List product specifications' })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ProductSpecificationResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Product not found' })
  findAll(
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<ProductSpecificationResponseDto[]> {
    return this.productSpecificationsService.findAll(productId);
  }
  @Post()
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Add a typed product specification' })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiCreatedResponse({ type: ProductSpecificationResponseDto })
  @ApiBadRequestResponse({
    description: 'Value is incompatible with attribute data type',
  })
  @ApiNotFoundResponse({ description: 'Product or attribute not found' })
  @ApiConflictResponse({
    description: 'Attribute already specified for product',
  })
  create(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() dto: CreateProductSpecificationDto,
  ): Promise<ProductSpecificationResponseDto> {
    return this.productSpecificationsService.create(productId, dto);
  }
  @Patch(':attributeId')
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Update a typed product specification' })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiParam({ name: 'attributeId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ProductSpecificationResponseDto })
  @ApiBadRequestResponse({
    description: 'Value is incompatible with attribute data type',
  })
  @ApiNotFoundResponse({
    description: 'Product, attribute, or specification not found',
  })
  update(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('attributeId', new ParseUUIDPipe()) attributeId: string,
    @Body() dto: UpdateProductSpecificationDto,
  ): Promise<ProductSpecificationResponseDto> {
    return this.productSpecificationsService.update(
      productId,
      attributeId,
      dto,
    );
  }
  @Delete(':attributeId')
  @Auth(ValidRoles.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a product specification' })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiParam({ name: 'attributeId', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Product specification soft-deleted' })
  @ApiNotFoundResponse({ description: 'Product or specification not found' })
  remove(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('attributeId', new ParseUUIDPipe()) attributeId: string,
  ): Promise<void> {
    return this.productSpecificationsService.remove(productId, attributeId);
  }
}
