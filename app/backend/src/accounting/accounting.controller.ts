import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import { CreateAccountDto, UpdateAccountDto, CreateJournalEntryDto } from './dto/accounting.dto';
import { PaginationQueryDto, Roles, CurrentUser } from '../common';

@ApiTags('accounting')
@ApiBearerAuth()
@Roles('Admin', 'Manager')
@Controller('accounting')
export class AccountingController {
  constructor(private accountingService: AccountingService) {}

  // Chart of Accounts
  @Get('accounts')
  @ApiOperation({ summary: 'Get chart of accounts' })
  getAccounts() {
    return this.accountingService.getAccounts();
  }

  @Get('accounts/:code')
  @ApiOperation({ summary: 'Get account by code' })
  getAccountByCode(@Param('code') code: string) {
    return this.accountingService.getAccountByCode(code);
  }

  @Post('accounts')
  @Roles('Admin')
  @ApiOperation({ summary: 'Create new account' })
  createAccount(@Body() dto: CreateAccountDto) {
    return this.accountingService.createAccount(dto);
  }

  @Put('accounts/:code')
  @Roles('Admin')
  @ApiOperation({ summary: 'Update account' })
  updateAccount(@Param('code') code: string, @Body() dto: UpdateAccountDto) {
    return this.accountingService.updateAccount(code, dto);
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
