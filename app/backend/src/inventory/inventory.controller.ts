import {
  Controller, Get, Post, Param, Query, Body, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateAdjustmentDto, InventoryQueryDto } from './dto';
import { Roles, RolesGuard, CurrentUser, CurrentUserData, PaginationQueryDto } from '../common';

@ApiTags('inventory')
@ApiBearerAuth('JWT-auth')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get current stock summary for all items' })
  async findAll(@Query() query: InventoryQueryDto, @Query() pagination: PaginationQueryDto) {
    return this.inventoryService.findAll(query, pagination);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get items below minimum stock level' })
  async getLowStock() {
    return this.inventoryService.getLowStock();
  }

  @Get('expiring')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get items expiring soon' })
  @ApiQuery({ name: 'days', required: false, description: 'Days ahead to check (default: 3)' })
  async getExpiring(@Query('days') days?: number) {
    return this.inventoryService.getExpiring(days || 3);
  }

  @Get(':itemId')
  @ApiOperation({ summary: 'Get stock for specific item' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  async findByItemId(@Param('itemId', ParseIntPipe) itemId: number) {
    return this.inventoryService.findByItemId(itemId);
  }

  @Get(':itemId/lots')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get FIFO lots for an item' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  async getLots(@Param('itemId', ParseIntPipe) itemId: number) {
    return this.inventoryService.getLots(itemId);
  }

  @Get(':itemId/movements')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get stock movement history for an item' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  async getMovements(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.inventoryService.getMovements(itemId, pagination);
  }

  @Post('adjustments')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Create manual stock adjustment' })
  @ApiResponse({ status: 201, description: 'Adjustment created successfully' })
  async createAdjustment(
    @Body() dto: CreateAdjustmentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.inventoryService.createAdjustment(dto, user.id);
  }
}
