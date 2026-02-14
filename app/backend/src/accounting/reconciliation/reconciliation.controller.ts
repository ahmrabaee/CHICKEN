import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OutstandingCalculatorService } from '../payment-ledger/outstanding-calculator.service';
import { ReconciliationService } from './reconciliation.service';
import { Roles, CurrentUser } from '../../common';
import { ApplyAllocationsDto } from './dto/apply-allocations.dto';

@ApiTags('reconciliation')
@ApiBearerAuth('JWT-auth')
@Roles('admin', 'manager')
@Controller('reconciliation')
export class ReconciliationController {
  constructor(
    private outstandingCalculator: OutstandingCalculatorService,
    private reconciliationService: ReconciliationService,
  ) {}

  @Get('outstanding/sale/:id')
  @ApiOperation({ summary: 'Get outstanding amount for a sale (Blueprint 04)' })
  getSaleOutstanding(@Param('id', ParseIntPipe) id: number) {
    return this.outstandingCalculator.getSaleOutstanding(id);
  }

  @Get('outstanding/purchase/:id')
  @ApiOperation({ summary: 'Get outstanding amount for a purchase (Blueprint 04)' })
  getPurchaseOutstanding(@Param('id', ParseIntPipe) id: number) {
    return this.outstandingCalculator.getPurchaseOutstanding(id);
  }

  @Get('outstanding/party')
  @ApiOperation({ summary: 'Get total outstanding for a party' })
  @ApiQuery({ name: 'partyType', required: true })
  @ApiQuery({ name: 'partyId', required: true })
  getPartyOutstanding(
    @Query('partyType') partyType: 'customer' | 'supplier',
    @Query('partyId', ParseIntPipe) partyId: number,
  ) {
    return this.outstandingCalculator.getPartyOutstanding(partyType, partyId);
  }

  @Get('open-invoices')
  @ApiOperation({ summary: 'Get open invoices for a party (Blueprint 04)' })
  @ApiQuery({ name: 'partyType', required: true })
  @ApiQuery({ name: 'partyId', required: true })
  getOpenInvoices(
    @Query('partyType') partyType: 'customer' | 'supplier',
    @Query('partyId', ParseIntPipe) partyId: number,
  ) {
    return this.reconciliationService.getOpenInvoices(partyType, partyId);
  }

  @Get('unallocated-payments')
  @ApiOperation({ summary: 'Get unallocated payments for a party (Blueprint 04)' })
  @ApiQuery({ name: 'partyType', required: true })
  @ApiQuery({ name: 'partyId', required: true })
  getUnallocatedPayments(
    @Query('partyType') partyType: 'customer' | 'supplier',
    @Query('partyId', ParseIntPipe) partyId: number,
  ) {
    return this.reconciliationService.getUnallocatedPayments(partyType, partyId);
  }

  @Get('suggest')
  @ApiOperation({ summary: 'Suggest allocation matches (Blueprint 04)' })
  @ApiQuery({ name: 'partyType', required: true })
  @ApiQuery({ name: 'partyId', required: true })
  suggest(
    @Query('partyType') partyType: 'customer' | 'supplier',
    @Query('partyId', ParseIntPipe) partyId: number,
  ) {
    return this.reconciliationService.suggest(partyType, partyId);
  }

  @Post('apply')
  @ApiOperation({ summary: 'Apply allocations (Blueprint 04)' })
  apply(@Body() body: ApplyAllocationsDto, @CurrentUser() user: { id: number }) {
    return this.reconciliationService.apply(
      body.partyType,
      body.partyId,
      body.allocations,
      user.id,
    );
  }
}

