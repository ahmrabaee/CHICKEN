import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { ChartOfAccountsModule } from './chart-of-accounts/chart-of-accounts.module';
import { GlEngineModule } from './gl-engine/gl-engine.module';
import { PaymentLedgerModule } from './payment-ledger/payment-ledger.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { TaxModule } from './tax/tax.module';

@Module({
  imports: [ChartOfAccountsModule, GlEngineModule, PaymentLedgerModule, ReconciliationModule, TaxModule],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService, ChartOfAccountsModule, GlEngineModule, PaymentLedgerModule, TaxModule],
})
export class AccountingModule {}
