import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, ParseIntPipe, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from './dto';
import { Roles, RolesGuard } from '../common';

@ApiTags('categories')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Roles('admin', 'cashier')
  @ApiOperation({ summary: 'List all categories' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  async findAll(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  @Roles('admin', 'cashier')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  async findById(@Param('id', ParseIntPipe) id: number): Promise<CategoryResponseDto> {
    return this.categoriesService.findById(id);
  }

  @Get('code/:code')
  @Roles('admin', 'cashier')
  @ApiOperation({ summary: 'Get category by code' })
  @ApiParam({ name: 'code', description: 'Category code' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  async findByCode(@Param('code') code: string): Promise<CategoryResponseDto> {
    return this.categoriesService.findByCode(code);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create category' })
  @ApiResponse({ status: 201, type: CategoryResponseDto })
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.categoriesService.create(dto);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete or deactivate category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoriesService.delete(id);
  }
}
