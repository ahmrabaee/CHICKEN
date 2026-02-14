import { Module } from '@nestjs/common';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { AllocationService } from './allocation.service';
import { PaymentLedgerModule } from '../payment-ledger/payment-ledger.module';

@Module({
  imports: [PaymentLedgerModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService, AllocationService],
})
export class ReconciliationModule {}
