import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto, ReceivePurchaseDto } from './dto/purchase.dto';
import { PaginationQueryDto, Roles, CurrentUser } from '../common';

@ApiTags('purchases')
@ApiBearerAuth('JWT-auth')
@Controller('purchases')
export class PurchasesController {
  constructor(private purchasesService: PurchasesService) { }

  @Get()
  @ApiOperation({ summary: 'List all purchases' })
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.purchasesService.findAll(pagination);
  }

  @Get('report/pdf')
  @ApiOperation({ summary: 'Download purchases report PDF' })
  async getPurchasesReportPdf(@Query() query: PdfQueryDto, @Res() res: Response) {
    const buffer = await this.purchasesService.getPurchasesReportPdf(query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="purchases-report.pdf"',
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.purchasesService.findById(id);
  }



  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download purchase order PDF' })
  async getPurchaseOrderPdf(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PdfQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.purchasesService.getPurchaseOrderPdf(id, query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="purchase-${id}.pdf"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Post()
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Create new purchase order' })
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: any) {
    return this.purchasesService.create(dto, user.id);
  }

  @Put(':id/receive')
  @Roles('admin', 'manager')
  @ApiOperation({ summary: 'Receive purchase order goods' })
  receive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceivePurchaseDto,
    @CurrentUser() user: any,
  ) {
    return this.purchasesService.receive(id, dto, user.id);
  }
}
