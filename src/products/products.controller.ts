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
  Query,
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
import { ProductsService } from './products.service';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import {
  CreateProductDto,
  ProductQueryDto,
  ProductSearchQueryDto,
  ProductSearchResponseDto,
  ProductResponseDto,
  UpdateProductDto,
} from './dto';
import { ProductSearchService } from './product-search.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productSearchService: ProductSearchService,
  ) {}

  @Post()
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Create a product' })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiNotFoundResponse({ description: 'Brand or category not found' })
  @ApiConflictResponse({ description: 'An active product uses the same slug' })
  create(
    @Body() createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'List active products' })
  @ApiOkResponse({ type: ProductResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  findAll(@Query() query: ProductQueryDto): Promise<ProductResponseDto[]> {
    return this.productsService.findAll(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search products with facets and pagination' })
  @ApiOkResponse({ type: ProductSearchResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid search parameters' })
  search(
    @Query() query: ProductSearchQueryDto,
  ): Promise<ProductSearchResponseDto> {
    return this.productSearchService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an active product by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid UUID' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProductResponseDto> {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Update an active product' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid UUID or request body' })
  @ApiNotFoundResponse({ description: 'Product, brand, or category not found' })
  @ApiConflictResponse({ description: 'An active product uses the same slug' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an active product' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Product soft-deleted' })
  @ApiBadRequestResponse({ description: 'Invalid UUID' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.productsService.remove(id);
  }
}
