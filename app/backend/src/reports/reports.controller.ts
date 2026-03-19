import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { Roles, RolesGuard } from '../common';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { getPdfContentDisposition } from '../pdf/pdf.helpers';

@ApiTags('reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Roles('admin', 'accountant')
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard summary' })
  getDashboard() {
    return this.reportsService.getDashboard();
  }

  @Get('sales')
  @ApiOperation({ summary: 'Get sales report' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  getSalesReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getSalesReport(startDate, endDate);
  }

  @Get('purchases')
  @ApiOperation({ summary: 'Get purchases report' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  getPurchasesReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getPurchasesReport(startDate, endDate);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Get inventory report' })
  getInventoryReport() {
    return this.reportsService.getInventoryReport();
  }

  @Get('wastage')
  @ApiOperation({ summary: 'Get wastage report' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  getWastageReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getWastageReport(startDate, endDate);
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Get expense report' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  getExpenseReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getExpenseReport(startDate, endDate);
  }

  @Get('profit-loss')
  @ApiOperation({ summary: 'Get profit & loss report' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  getProfitLossReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getProfitLossReport(startDate, endDate);
  }

  @Get('stock-vs-gl')
  @ApiOperation({ summary: 'Stock vs GL reconciliation (Blueprint 06)' })
  @ApiQuery({ name: 'asOfDate', required: false, description: 'Date for comparison (ISO)' })
  @ApiQuery({ name: 'branchId', required: false })
  getStockVsGLReport(
    @Query('asOfDate') asOfDate?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.getStockVsGLReport(
      asOfDate ? new Date(asOfDate) : new Date(),
      branchId ? parseInt(branchId, 10) : undefined,
    );
  }

  // ─── PDF Endpoints ───────────────────────────────────────────────────────────

  @Get('wastage/pdf')
  @ApiOperation({ summary: 'Download wastage report PDF' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getWastageReportPdf(@Query() query: PdfQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.getWastageReportPdf(query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition('wastage-report.pdf', query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get('vat/pdf')
  @ApiOperation({ summary: 'Download VAT report PDF' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getVatReportPdf(@Query() query: PdfQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.getVatReportPdf(query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition('vat-report.pdf', query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get('stock-vs-gl/pdf')
  @ApiOperation({ summary: 'Download stock vs GL report PDF' })
  @ApiQuery({ name: 'asOfDate', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  async getStockVsGLReportPdf(@Query() query: PdfQueryDto, @Res() res: Response) {
    const buffer = await this.reportsService.getStockVsGLReportPdf(query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition('stock-vs-gl-report.pdf', query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }
}
