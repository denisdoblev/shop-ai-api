import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { CategoryAttributesService } from './category-attributes.service';
import {
  CategoryAttributeResponseDto,
  CreateCategoryAttributeDto,
} from './dto';

@ApiTags('categories')
@Controller('categories/:categoryId/attributes')
export class CategoryAttributesController {
  constructor(
    private readonly categoryAttributesService: CategoryAttributesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List suggested attributes for a category' })
  @ApiParam({ name: 'categoryId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CategoryAttributeResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid category UUID' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  findAll(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
  ): Promise<CategoryAttributeResponseDto[]> {
    return this.categoryAttributesService.findAll(categoryId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a suggested attribute to a category' })
  @ApiParam({ name: 'categoryId', type: String, format: 'uuid' })
  @ApiCreatedResponse({ type: CategoryAttributeResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid UUID or request body' })
  @ApiNotFoundResponse({ description: 'Category or attribute not found' })
  @ApiConflictResponse({ description: 'Attribute already active for category' })
  create(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Body() createCategoryAttributeDto: CreateCategoryAttributeDto,
  ): Promise<CategoryAttributeResponseDto> {
    return this.categoryAttributesService.create(
      categoryId,
      createCategoryAttributeDto,
    );
  }

  @Delete(':attributeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a suggested attribute from a category' })
  @ApiParam({ name: 'categoryId', type: String, format: 'uuid' })
  @ApiParam({ name: 'attributeId', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Category attribute soft-deleted' })
  @ApiBadRequestResponse({ description: 'Invalid UUID' })
  @ApiNotFoundResponse({ description: 'Category or association not found' })
  remove(
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Param('attributeId', new ParseUUIDPipe()) attributeId: string,
  ): Promise<void> {
    return this.categoryAttributesService.remove(categoryId, attributeId);
  }
}
