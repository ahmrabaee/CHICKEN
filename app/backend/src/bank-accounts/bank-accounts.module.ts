import { Module } from '@nestjs/common';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';
import { ChartOfAccountsModule } from '../accounting/chart-of-accounts/chart-of-accounts.module';

@Module({
  imports: [ChartOfAccountsModule],
  controllers: [BankAccountsController],
  providers: [BankAccountsService],
  exports: [BankAccountsService],
})
export class BankAccountsModule {}
