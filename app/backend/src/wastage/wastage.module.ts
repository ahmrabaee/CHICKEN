import { Module } from '@nestjs/common';
import { WastageController } from './wastage.controller';
import { WastageService } from './wastage.service';
import { AccountingModule } from '../accounting/accounting.module';
import { StockLedgerModule } from '../inventory/stock-ledger/stock-ledger.module';

@Module({
  imports: [AccountingModule, StockLedgerModule], // fix H-4: SLE + branch stock account
  controllers: [WastageController],
  providers: [WastageService],
  exports: [WastageService],
})
export class WastageModule {}
