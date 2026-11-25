import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { AccountingModule } from '../accounting/accounting.module';
import { StockLedgerModule } from '../inventory/stock-ledger/stock-ledger.module';

@Module({
  imports: [AccountingModule, StockLedgerModule], // fix C-3: post opening-stock GL entry
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
