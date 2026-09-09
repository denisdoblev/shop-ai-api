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
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { AttributesService } from './attributes.service';
import {
  AttributeResponseDto,
  CreateAttributeDto,
  UpdateAttributeDto,
} from './dto';

@ApiTags('attributes')
@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Post()
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Create an attribute' })
  @ApiCreatedResponse({ type: AttributeResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiConflictResponse({
    description: 'An active attribute uses the same slug',
  })
  create(
    @Body() createAttributeDto: CreateAttributeDto,
  ): Promise<AttributeResponseDto> {
    return this.attributesService.create(createAttributeDto);
  }

  @Get()
  @ApiOperation({ summary: 'List active attributes' })
  @ApiOkResponse({ type: AttributeResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid pagination parameters' })
  findAll(
    @Query() paginationDto: PaginationDto,
  ): Promise<AttributeResponseDto[]> {
    return this.attributesService.findAll(
      paginationDto.limit,
      paginationDto.offset,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an active attribute by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AttributeResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid UUID' })
  @ApiNotFoundResponse({ description: 'Attribute not found' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AttributeResponseDto> {
    return this.attributesService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Update an active attribute' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AttributeResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid UUID or request body' })
  @ApiNotFoundResponse({ description: 'Attribute not found' })
  @ApiConflictResponse({
    description:
      'An active attribute uses the same slug or its data type has existing specifications',
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateAttributeDto: UpdateAttributeDto,
  ): Promise<AttributeResponseDto> {
    return this.attributesService.update(id, updateAttributeDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an active attribute' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Attribute soft-deleted' })
  @ApiBadRequestResponse({ description: 'Invalid UUID' })
  @ApiNotFoundResponse({ description: 'Attribute not found' })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.attributesService.remove(id);
  }
}
