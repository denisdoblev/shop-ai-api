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
import { ProductImagesService } from './product-images.service';
import { CreateProductImageDto, ProductImageResponseDto } from './dto';
import { Auth } from '../../auth/decorators';
import { ValidRoles } from '../../auth/interfaces';

@ApiTags('products')
@Controller('products/:productId/images')
export class ProductImagesController {
  constructor(private readonly productImagesService: ProductImagesService) {}

  @Get()
  @ApiOperation({ summary: 'List images for a product' })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ProductImageResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid product UUID' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  findAll(
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<ProductImageResponseDto[]> {
    return this.productImagesService.findAll(productId);
  }

  @Post()
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Add an image to a product' })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiCreatedResponse({ type: ProductImageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid UUID or request body' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiConflictResponse({
    description: 'Image position already active for product',
  })
  create(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() createProductImageDto: CreateProductImageDto,
  ): Promise<ProductImageResponseDto> {
    return this.productImagesService.create(productId, createProductImageDto);
  }
}
