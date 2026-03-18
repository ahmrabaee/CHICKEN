import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseIntPipe,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { getPdfContentDisposition } from '../pdf/pdf.helpers';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import {
  RecordSalePaymentDto,
  RecordPurchasePaymentDto,
  PaymentQueryDto,
  CancelPaymentDto,
  CreateAdvancePaymentDto,
} from './dto/payment.dto';
import { CurrentUser, Roles, RolesGuard } from '../common';

@ApiTags('payments')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)   // WK-13: Enforce role-based access control on all payment endpoints
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) { }

  @Get()
  @Roles('admin', 'accountant', 'cashier')
  @ApiOperation({ summary: 'List all payments' })
  findAll(@Query() query: PaymentQueryDto) {
    return this.paymentsService.findAll(query, query.type);
  }

  @Get(':id/pdf')
  @Roles('admin', 'accountant', 'cashier')
  @ApiOperation({ summary: 'Download payment voucher PDF' })
  async getPaymentPdf(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PdfQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.paymentsService.getPaymentPdf(id, query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition(`payment-${id}.pdf`, query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Post('sale')
  @Roles('admin', 'accountant', 'cashier')
  @ApiOperation({ summary: 'Record a sale payment' })
  recordSalePayment(@Body() dto: RecordSalePaymentDto, @CurrentUser() user: any) {
    return this.paymentsService.recordSalePayment(dto, user.id);
  }

  @Post('purchase')
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'Record a purchase payment' })
  recordPurchasePayment(@Body() dto: RecordPurchasePaymentDto, @CurrentUser() user: any) {
    return this.paymentsService.recordPurchasePayment(dto, user.id);
  }

  @Post('advance')
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'Create advance payment (Blueprint 04 - for reconciliation)' })
  createAdvancePayment(@Body() dto: CreateAdvancePaymentDto, @CurrentUser() user: any) {
    return this.paymentsService.createAdvancePayment(dto, user.id);
  }

  @Post(':id/cancel')
  @Roles('admin', 'accountant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel payment (creates GL reversal)',
    description: 'Blueprint 03: Cancels payment with full GL reversal. Use instead of void.',
  })
  cancelPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelPaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.cancelPayment(id, dto.reason, user.id);
  }

  @Get(':id')
  @Roles('admin', 'accountant', 'cashier')
  @ApiOperation({ summary: 'Get payment by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.findById(id);
  }
}

