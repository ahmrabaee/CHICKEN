import { Controller, Get, Post, Put, Delete, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TaxTemplateService } from './tax-template.service';
import { VatReportService } from './vat-report.service';
import { Roles } from '../../common';

@ApiTags('tax')
@ApiBearerAuth('JWT-auth')
@Controller('tax')
export class TaxTemplateController {
  constructor(
    private taxTemplateService: TaxTemplateService,
    private vatReportService: VatReportService,
  ) {}

  @Get('templates')
  @ApiOperation({ summary: 'List tax templates' })
  getTemplates(@Query('type') type?: 'sales' | 'purchases', @Query('companyId') companyId?: string) {
    return this.taxTemplateService.findAll(type, companyId ? parseInt(companyId, 10) : undefined);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get tax template by ID' })
  getTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.taxTemplateService.findById(id);
  }

  @Post('templates')
  @Roles('admin')
  @ApiOperation({ summary: 'Create tax template' })
  createTemplate(@Body() body: { name: string; type: 'sales' | 'purchases'; companyId?: number; items: Array<{ accountId: number; rate: number; chargeType?: string; rowId?: number; fixedAmount?: number; displayOrder?: number }> }) {
    return this.taxTemplateService.create(body);
  }

  @Put('templates/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update tax template' })
  updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; isActive?: boolean; items?: Array<{ accountId: number; rate: number; chargeType?: string; rowId?: number; fixedAmount?: number; displayOrder?: number }> },
  ) {
    return this.taxTemplateService.update(id, body);
  }

  @Delete('templates/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete tax template' })
  deleteTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.taxTemplateService.delete(id);
  }

  @Get('vat-report')
  @ApiOperation({ summary: 'VAT report' })
  @Roles('admin', 'manager')
  getVatReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('companyId') companyId?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();
    return this.vatReportService.generateVATReport(start, end, companyId ? parseInt(companyId, 10) : undefined);
  }
}
