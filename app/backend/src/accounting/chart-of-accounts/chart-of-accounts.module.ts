import { Module } from '@nestjs/common';
import { AccountRepository } from './account.repository';
import { AccountTreeBuilderService } from './account-tree-builder.service';
import { AccountValidatorService } from './account-validator.service';
import { PreventGroupPostingGuard } from './prevent-group-posting.guard';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { AccountController } from './account.controller';

@Module({
  controllers: [AccountController],
  providers: [
    AccountRepository,
    AccountTreeBuilderService,
    AccountValidatorService,
    PreventGroupPostingGuard,
    ChartOfAccountsService,
  ],
  exports: [ChartOfAccountsService, AccountRepository, PreventGroupPostingGuard, AccountTreeBuilderService],
})
export class ChartOfAccountsModule { }
