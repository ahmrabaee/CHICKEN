import { Module } from '@nestjs/common';
import { PaymentLedgerService } from './payment-ledger.service';
import { OutstandingCalculatorService } from './outstanding-calculator.service';

@Module({
  providers: [PaymentLedgerService, OutstandingCalculatorService],
  exports: [PaymentLedgerService, OutstandingCalculatorService],
})
export class PaymentLedgerModule {}
