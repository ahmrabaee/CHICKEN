import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, ParseIntPipe, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { CreateItemDto, UpdateItemDto, ItemResponseDto, ItemListQueryDto } from './dto';
import { Roles, RolesGuard, CurrentUser, CurrentUserData, PaginatedResult } from '../common';

@ApiTags('items')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) { }

  @Get()
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'List all items with filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of items' })
  async findAll(@Query() query: ItemListQueryDto): Promise<PaginatedResult<ItemResponseDto>> {
    return this.itemsService.findAll(query);
  }

  @Get(':id')
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'Get item by ID' })
  @ApiParam({ name: 'id', description: 'Item ID' })
  @ApiResponse({ status: 200, type: ItemResponseDto })
  async findById(@Param('id', ParseIntPipe) id: number): Promise<ItemResponseDto> {
    return this.itemsService.findById(id);
  }

  @Get('code/:code')
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'Get item by code' })
  @ApiParam({ name: 'code', description: 'Item code' })
  @ApiResponse({ status: 200, type: ItemResponseDto })
  async findByCode(@Param('code') code: string): Promise<ItemResponseDto> {
    return this.itemsService.findByCode(code);
  }

  @Get('barcode/:barcode')
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'Get item by barcode' })
  @ApiParam({ name: 'barcode', description: 'Item barcode' })
  @ApiResponse({ status: 200, type: ItemResponseDto })
  async findByBarcode(@Param('barcode') barcode: string): Promise<ItemResponseDto> {
    return this.itemsService.findByBarcode(barcode);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create item' })
  @ApiResponse({ status: 201, type: ItemResponseDto })
  async create(
    @Body() dto: CreateItemDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ItemResponseDto> {
    return this.itemsService.create(dto, user?.id);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update item' })
  @ApiParam({ name: 'id', description: 'Item ID' })
  @ApiResponse({ status: 200, type: ItemResponseDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateItemDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ItemResponseDto> {
    return this.itemsService.update(id, dto, user?.id);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate item' })
  @ApiParam({ name: 'id', description: 'Item ID' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.itemsService.delete(id);
  }
}
