import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import {
  RecordSalePaymentDto,
  RecordPurchasePaymentDto,
  PaymentQueryDto,
  CancelPaymentDto,
  CreateAdvancePaymentDto,
} from './dto/payment.dto';
import { CurrentUser } from '../common';

@ApiTags('payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) { }

  @Get()
  @ApiOperation({ summary: 'List all payments' })
  findAll(@Query() query: PaymentQueryDto) {
    return this.paymentsService.findAll(query, query.type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.findById(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download payment voucher PDF' })
  async getPaymentPdf(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PdfQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.paymentsService.getPaymentPdf(id, query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="payment-${id}.pdf"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Post('sale')
  @ApiOperation({ summary: 'Record a sale payment' })
  recordSalePayment(@Body() dto: RecordSalePaymentDto, @CurrentUser() user: any) {
    return this.paymentsService.recordSalePayment(dto, user.id);
  }

  @Post('purchase')
  @ApiOperation({ summary: 'Record a purchase payment' })
  recordPurchasePayment(@Body() dto: RecordPurchasePaymentDto, @CurrentUser() user: any) {
    return this.paymentsService.recordPurchasePayment(dto, user.id);
  }

  @Post('advance')
  @ApiOperation({ summary: 'Create advance payment (Blueprint 04 - for reconciliation)' })
  createAdvancePayment(@Body() dto: CreateAdvancePaymentDto, @CurrentUser() user: any) {
    return this.paymentsService.createAdvancePayment(dto, user.id);
  }

  @Post(':id/cancel')
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
}
