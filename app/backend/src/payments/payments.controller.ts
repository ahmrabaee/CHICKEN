import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { RecordSalePaymentDto, RecordPurchasePaymentDto, PaymentQueryDto } from './dto/payment.dto';
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
}
