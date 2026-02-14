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
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Roles } from '../../common';

@ApiTags('accounting')
@ApiBearerAuth('JWT-auth')
@Controller('accounting')
export class AccountController {
  constructor(private chartOfAccountsService: ChartOfAccountsService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'Get chart of accounts (tree)' })
  @ApiQuery({ name: 'postableOnly', required: false, type: Boolean })
  @Roles('admin', 'manager')
  getAccounts(@Query('postableOnly') postableOnly?: string) {
    const postable = postableOnly === 'true';
    return this.chartOfAccountsService.getAccounts(1, postable);
  }

  @Get('accounts/code/:code')
  @ApiOperation({ summary: 'Get account by code' })
  @Roles('admin', 'manager')
  getAccountByCode(@Param('code') code: string) {
    return this.chartOfAccountsService.getAccountByCode(code);
  }

  @Get('accounts/:id/can-delete')
  @ApiOperation({ summary: 'Check if account can be deleted' })
  @Roles('admin')
  canDelete(@Param('id', ParseIntPipe) id: number) {
    return this.chartOfAccountsService.canDelete(id);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get account by ID or code (backward compatible)' })
  @Roles('admin', 'manager')
  getAccountByIdOrCode(@Param('id') param: string) {
    return this.chartOfAccountsService.getAccountByCodeOrId(param);
  }

  @Post('accounts')
  @Roles('admin')
  @ApiOperation({ summary: 'Create new account' })
  createAccount(@Body() dto: CreateAccountDto) {
    return this.chartOfAccountsService.createAccount(dto);
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

  @Post('accounts/rebuild-tree')
  @Roles('admin')
  @ApiOperation({ summary: 'Rebuild nested set tree' })
  rebuildTree() {
    return this.chartOfAccountsService.rebuildTree();
  }
}
