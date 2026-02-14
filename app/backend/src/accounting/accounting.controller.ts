import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import { ChartOfAccountsService } from './chart-of-accounts/chart-of-accounts.service';
import { CreateJournalEntryDto } from './dto/accounting.dto';
import { CreateAccountDto } from './chart-of-accounts/dto/create-account.dto';
import { UpdateAccountDto } from './chart-of-accounts/dto/update-account.dto';
import { PaginationQueryDto, Roles, CurrentUser } from '../common';

@ApiTags('accounting')
@ApiBearerAuth('JWT-auth')
@Roles('admin', 'manager')
@Controller('accounting')
export class AccountingController {
  constructor(
    private accountingService: AccountingService,
    private chartOfAccountsService: ChartOfAccountsService,
  ) {}

  // Chart of Accounts
  @Get('accounts')
  @ApiOperation({ summary: 'Get chart of accounts (tree)' })
  @ApiQuery({ name: 'postableOnly', required: false, type: Boolean })
  getAccounts(@Query('postableOnly') postableOnly?: string) {
    const postable = postableOnly === 'true';
    return this.chartOfAccountsService.getAccounts(1, postable);
  }

  @Get('accounts/code/:code')
  @ApiOperation({ summary: 'Get account by code' })
  getAccountByCode(@Param('code') code: string) {
    return this.chartOfAccountsService.getAccountByCode(code);
  }

  @Get('accounts/:id/can-delete')
  @ApiOperation({ summary: 'Check if account can be deleted' })
  @Roles('admin')
  canDeleteAccount(@Param('id', ParseIntPipe) id: number) {
    return this.chartOfAccountsService.canDelete(id);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get account by ID or code' })
  getAccountByIdOrCode(@Param('id') param: string) {
    return this.chartOfAccountsService.getAccountByCodeOrId(param);
  }

  @Post('accounts')
  @Roles('admin')
  @ApiOperation({ summary: 'Create new account' })
  createAccount(@Body() dto: CreateAccountDto) {
    return this.chartOfAccountsService.createAccount(dto);
  }

  @Post('accounts/rebuild-tree')
  @Roles('admin')
  @ApiOperation({ summary: 'Rebuild nested set tree' })
  rebuildAccountTree() {
    return this.chartOfAccountsService.rebuildTree();
  }

  @Put('accounts/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update account' })
  updateAccount(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAccountDto) {
    return this.chartOfAccountsService.updateAccount(id, dto);
  }

  @Delete('accounts/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete account' })
  deleteAccount(@Param('id', ParseIntPipe) id: number) {
    return this.chartOfAccountsService.deleteAccount(id);
  }

  // Journal Entries
  @Get('journal-entries')
  @ApiOperation({ summary: 'List journal entries' })
  getJournalEntries(@Query() pagination: PaginationQueryDto) {
    return this.accountingService.getJournalEntries(pagination);
  }

  @Get('journal-entries/:id')
  @ApiOperation({ summary: 'Get journal entry by ID' })
  getJournalEntryById(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.getJournalEntryById(id);
  }

  @Post('journal-entries')
  @ApiOperation({ summary: 'Create manual journal entry' })
  createJournalEntry(@Body() dto: CreateJournalEntryDto, @CurrentUser() user: any) {
    return this.accountingService.createJournalEntry(dto, user.id);
  }

  @Post('journal-entries/:id/post')
  @ApiOperation({ summary: 'Post journal entry' })
  postJournalEntry(@Param('id', ParseIntPipe) id: number) {
    return this.accountingService.postJournalEntry(id);
  }

  // Reports
  @Get('trial-balance')
  @ApiOperation({ summary: 'Get trial balance' })
  @ApiQuery({ name: 'asOfDate', required: false })
  getTrialBalance(@Query('asOfDate') asOfDate?: string) {
    return this.accountingService.getTrialBalance(asOfDate);
  }

  @Get('ledger/:accountCode')
  @ApiOperation({ summary: 'Get account ledger' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getAccountLedger(
    @Param('accountCode') accountCode: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.accountingService.getAccountLedger(accountCode, startDate, endDate);
  }
}
