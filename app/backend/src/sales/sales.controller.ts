import {
  Controller, Get, Post, Param, Query, Body, ParseIntPipe, HttpCode, HttpStatus, UseGuards, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSaleDto, VoidSaleDto, AddPaymentDto, SaleQueryDto } from './dto';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { getPdfContentDisposition } from '../pdf/pdf.helpers';
import { Roles, RolesGuard, CurrentUser, CurrentUserData, PaginationQueryDto } from '../common';

@ApiTags('sales')
@ApiBearerAuth('JWT-auth')
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) { }

  @Get()
  @ApiOperation({ summary: 'List sales (paginated)' })
  @ApiResponse({ status: 200, description: 'List of sales' })
  async findAll(
    @Query() query: SaleQueryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const isAdmin = user.roles.includes('admin');
    return this.salesService.findAll(query, query, user.id, isAdmin);
  }

  @Get('report/pdf')
  @ApiOperation({ summary: 'Download sales report PDF' })
  async getSalesReportPdf(@Query() query: PdfQueryDto, @Res() res: Response) {
    const buffer = await this.salesService.getSalesReportPdf(query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition('sales-report.pdf', query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sale details with cost allocation' })
  @ApiParam({ name: 'id', description: 'Sale ID' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.salesService.findById(id);
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Get receipt data for printing' })
  @ApiParam({ name: 'id', description: 'Sale ID' })
  async getReceipt(@Param('id', ParseIntPipe) id: number) {
    return this.salesService.getReceipt(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download sales invoice PDF' })
  @ApiParam({ name: 'id', description: 'Sale ID' })
  async getInvoicePdf(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PdfQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.salesService.getInvoicePdf(id, query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition(`invoice-${id}.pdf`, query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Post()
  @ApiOperation({ summary: 'Create new sale (POS transaction)' })
  @ApiResponse({ status: 201, description: 'Sale created successfully' })
  async create(@Body() dto: CreateSaleDto, @CurrentUser() user: CurrentUserData) {
    return this.salesService.create(dto, user.id, user.roles ?? [], user.branchId);
  }



  @Post(':id/void')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void a sale (Admin only)' })
  @ApiParam({ name: 'id', description: 'Sale ID' })
  async voidSale(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VoidSaleDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.salesService.voidSale(id, dto, user.id);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Add payment to sale' })
  @ApiParam({ name: 'id', description: 'Sale ID' })
  async addPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddPaymentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.salesService.addPayment(id, dto, user.id);
  }
}
