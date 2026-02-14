import { Module } from '@nestjs/common';
import { StockLedgerService } from './stock-ledger.service';
import { StockAccountMapperService } from './stock-account-mapper.service';
import { StockReconciliationService } from './stock-reconciliation.service';

@Module({
  providers: [StockLedgerService, StockAccountMapperService, StockReconciliationService],
  exports: [StockLedgerService, StockAccountMapperService, StockReconciliationService],
})
export class StockLedgerModule {}
