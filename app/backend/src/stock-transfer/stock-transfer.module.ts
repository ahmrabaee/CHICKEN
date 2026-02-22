import { Module } from '@nestjs/common';
import { StockTransferController } from './stock-transfer.controller';
import { StockTransferService } from './stock-transfer.service';
import { StockLedgerModule } from '../inventory/stock-ledger/stock-ledger.module';

@Module({
  imports: [StockLedgerModule],
  controllers: [StockTransferController],
  providers: [StockTransferService],
  exports: [StockTransferService],
})
export class StockTransferModule {}
