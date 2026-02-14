import { Module } from '@nestjs/common';
import { CreditNoteController } from './credit-note.controller';
import { CreditNoteService } from './credit-note.service';
import { PaymentLedgerModule } from '../payment-ledger/payment-ledger.module';
import { AccountingModule } from '../accounting.module';

@Module({
  imports: [PaymentLedgerModule, AccountingModule],
  controllers: [CreditNoteController],
  providers: [CreditNoteService],
})
export class CreditNoteModule {}

