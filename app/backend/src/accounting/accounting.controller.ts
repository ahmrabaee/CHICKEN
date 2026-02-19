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
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import { ChartOfAccountsService } from './chart-of-accounts/chart-of-accounts.service';
import { CreateJournalEntryDto } from './dto/accounting.dto';
import { CreateAccountDto } from './chart-of-accounts/dto/create-account.dto';
import { UpdateAccountDto } from './chart-of-accounts/dto/update-account.dto';
import { PaginationQueryDto, Roles, CurrentUser, RolesGuard } from '../common';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { getPdfContentDisposition } from '../pdf/pdf.helpers';
import { Response } from 'express';

@ApiTags('accounting')
@ApiBearerAuth('JWT-auth')
@Controller('accounting')
@UseGuards(RolesGuard)
@Roles('admin', 'manager')
export class AccountingController {
  constructor(
    private accountingService: AccountingService,
    private chartOfAccountsService: ChartOfAccountsService,
  ) { }

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
  createAccount(@Body() dto: CreateAccountDto, @CurrentUser() user: { id: number; username: string }) {
    return this.chartOfAccountsService.createAccount(dto, 1, user);
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
  updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: { id: number; username: string },
  ) {
    return this.chartOfAccountsService.updateAccount(id, dto, 1, user);
  }

  @Delete('accounts/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete account' })
  deleteAccount(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number; username: string }) {
    return this.chartOfAccountsService.deleteAccount(id, 1, user);
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
  createJournalEntry(@Body() dto: CreateJournalEntryDto, @CurrentUser() user: { id: number }) {
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

  // PDF Reports
  @Get('reports/balance-sheet/pdf')
  @ApiOperation({ summary: 'Download Balance Sheet PDF' })
  @ApiQuery({ name: 'asOfDate', required: false })
  @ApiQuery({ name: 'language', required: false })
  async getBalanceSheetPdf(@Query() query: PdfQueryDto, @Res() res: Response) {
    const buffer = await this.accountingService.getBalanceSheetPdf(query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition('balance-sheet.pdf', query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get('reports/income-statement/pdf')
  @ApiOperation({ summary: 'Download Income Statement PDF' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'language', required: false })
  async getIncomeStatementPdf(@Query() query: PdfQueryDto, @Res() res: Response) {
    const buffer = await this.accountingService.getIncomeStatementPdf(query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition('income-statement.pdf', query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get('reports/trial-balance/pdf')
  @ApiOperation({ summary: 'Download Trial Balance PDF' })
  @ApiQuery({ name: 'asOfDate', required: false })
  @ApiQuery({ name: 'language', required: false })
  async getTrialBalancePdf(@Query() query: PdfQueryDto, @Res() res: Response) {
    const buffer = await this.accountingService.getTrialBalancePdf(query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition('trial-balance.pdf', query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get('reports/ledger/:accountCode/pdf')
  @ApiOperation({ summary: 'Download Account Ledger PDF' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'language', required: false })
  async getAccountLedgerPdf(
    @Param('accountCode') accountCode: string,
    @Query() query: PdfQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.accountingService.getAccountLedgerPdf(accountCode, query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition(`ledger-${accountCode}.pdf`, query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }
}
