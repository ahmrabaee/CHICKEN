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
import { RecordSalePaymentDto, RecordPurchasePaymentDto } from './dto/payment.dto';
import { PaginationQueryDto, CurrentUser } from '../common';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all payments' })
  @ApiQuery({ name: 'type', required: false, enum: ['sale', 'purchase', 'debt'] })
  findAll(@Query() pagination: PaginationQueryDto, @Query('type') type?: string) {
    return this.paymentsService.findAll(pagination, type);
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
