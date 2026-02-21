import {
  Controller, Get, Post, Param, Query, Body, ParseIntPipe, UseGuards, Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateAdjustmentDto, InventoryQueryDto } from './dto';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { getPdfContentDisposition } from '../pdf/pdf.helpers';
import { Response } from 'express';
import { Roles, RolesGuard, CurrentUser, CurrentUserData, PaginationQueryDto } from '../common';

@ApiTags('inventory')
@ApiBearerAuth('JWT-auth')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) { }

  @Get()
  @ApiOperation({ summary: 'List inventory items' })
  findAll(@Query() query: InventoryQueryDto) {
    return this.inventoryService.findAll(query);
  }

  @Get('report/pdf')
  @ApiOperation({ summary: 'Download inventory report PDF' })
  async getInventoryReportPdf(@Query() query: PdfQueryDto, @Res() res: Response) {
    const buffer = await this.inventoryService.getInventoryReportPdf(query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition('inventory-report.pdf', query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get items below minimum stock level' })
  async getLowStock() {
    return this.inventoryService.getLowStock();
  }

  @Get('expiring')
  @UseGuards(RolesGuard)
  @Roles('admin', 'accountant')
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
    @Query() query: PaginationQueryDto,
  ) {
    return this.inventoryService.getMovements(itemId, query);
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
