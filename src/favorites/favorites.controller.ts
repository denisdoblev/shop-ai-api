import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Auth, GetUser } from '../auth/decorators';
import { FavoriteQueryDto } from './dto/favorite-query.dto';
import { FavoriteResponseDto } from './dto/favorite-response.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@Auth()
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'List favorites for the authenticated user' })
  @ApiOkResponse({ type: FavoriteResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid product ID' })
  findAll(
    @GetUser('id') userId: string,
    @Query() query: FavoriteQueryDto,
  ): Promise<FavoriteResponseDto[]> {
    return this.favoritesService.findAll(userId, query.productId);
  }

  @Put(':productId')
  @ApiOperation({ summary: 'Create or restore a product favorite' })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: FavoriteResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid product ID' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  put(
    @GetUser('id') userId: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<FavoriteResponseDto> {
    return this.favoritesService.put(userId, productId);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a product favorite' })
  @ApiParam({ name: 'productId', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Favorite removed or already absent' })
  @ApiBadRequestResponse({ description: 'Invalid product ID' })
  remove(
    @GetUser('id') userId: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<void> {
    return this.favoritesService.remove(userId, productId);
  }
}
