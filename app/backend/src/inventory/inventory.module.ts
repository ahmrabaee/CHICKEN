import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockLedgerModule } from './stock-ledger/stock-ledger.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [StockLedgerModule, AccountingModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService, StockLedgerModule],
})
export class InventoryModule {}
