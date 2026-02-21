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
import { Roles, CurrentUser } from '../../common';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('accounting')
@ApiBearerAuth('JWT-auth')
@Controller('accounting')
export class AccountController {
  constructor(private chartOfAccountsService: ChartOfAccountsService) { }

  @Get('accounts')
  @ApiOperation({ summary: 'Get chart of accounts (tree)' })
  @ApiQuery({ name: 'postableOnly', required: false, type: Boolean })
  @Roles('admin', 'accountant')
  getAccounts(@Query('postableOnly') postableOnly?: string) {
    const postable = postableOnly === 'true';
    return this.chartOfAccountsService.getAccounts(1, postable);
  }

  @Get('accounts/code/:code')
  @ApiOperation({ summary: 'Get account by code' })
  @Roles('admin', 'accountant')
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
  @Roles('admin', 'accountant')
  getAccountByIdOrCode(@Param('id') param: string) {
    return this.chartOfAccountsService.getAccountByCodeOrId(param);
  }

  @Post('accounts')
  @Roles('admin')
  @ApiOperation({ summary: 'Create new account' })
  createAccount(@Body() dto: CreateAccountDto, @CurrentUser() user: CurrentUserData) {
    return this.chartOfAccountsService.createAccount(dto, 1, user);
  }

  @Put('accounts/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update account' })
  updateAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.chartOfAccountsService.updateAccount(id, dto, 1, user);
  }

  @Delete('accounts/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete account' })
  deleteAccount(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserData) {
    return this.chartOfAccountsService.deleteAccount(id, 1, user);
  }

  @Post('accounts/rebuild-tree')
  @Roles('admin')
  @ApiOperation({ summary: 'Rebuild nested set tree' })
  rebuildTree() {
    return this.chartOfAccountsService.rebuildTree();
  }
}
