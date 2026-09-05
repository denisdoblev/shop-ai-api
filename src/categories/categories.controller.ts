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
import { PaginationDto } from '../common/dto';
import { CategoriesService } from './categories.service';
import {
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a category' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiNotFoundResponse({ description: 'Parent category not found' })
  @ApiConflictResponse({ description: 'An active category uses the same slug' })
  create(
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'List active categories' })
  @ApiOkResponse({ type: CategoryResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid pagination parameters' })
  findAll(
    @Query() paginationDto: PaginationDto,
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAll(
      paginationDto.limit,
      paginationDto.offset,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an active category by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid UUID' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an active category' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid UUID or request body' })
  @ApiNotFoundResponse({ description: 'Category or parent category not found' })
  @ApiConflictResponse({ description: 'An active category uses the same slug' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an active category' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Category soft-deleted' })
  @ApiBadRequestResponse({ description: 'Invalid UUID' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
