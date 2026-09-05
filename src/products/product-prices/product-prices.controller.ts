import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateProductPriceDto, ProductPriceResponseDto } from './dto';
import { ProductPricesService } from './product-prices.service';

@ApiTags('products')
@Controller('products/:productId/prices')
export class ProductPricesController {
  constructor(private readonly productPricesService: ProductPricesService) {}

  @Get()
  @ApiOperation({ summary: 'List a product price history' })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ProductPriceResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid product UUID' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  findAll(
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<ProductPriceResponseDto[]> {
    return this.productPricesService.findAll(productId);
  }

  @Post()
  @ApiOperation({ summary: 'Record a new product price' })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiCreatedResponse({ type: ProductPriceResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid UUID or request body' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiConflictResponse({
    description: 'Price timestamp already active for product',
  })
  create(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() createProductPriceDto: CreateProductPriceDto,
  ): Promise<ProductPriceResponseDto> {
    return this.productPricesService.create(productId, createProductPriceDto);
  }
}
