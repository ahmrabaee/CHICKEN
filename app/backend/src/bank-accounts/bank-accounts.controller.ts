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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { Roles, RolesGuard } from '../common';

@ApiTags('bank-accounts')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Roles('admin')
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private bankAccountsService: BankAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List all bank accounts' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAll(@Query('includeInactive') includeInactive?: string) {
    const include = includeInactive === 'true';
    return this.bankAccountsService.findAll(include);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get default bank account' })
  getDefault() {
    return this.bankAccountsService.getDefault();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bank account by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.bankAccountsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create bank account' })
  create(@Body() dto: CreateBankAccountDto) {
    return this.bankAccountsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update bank account' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBankAccountDto) {
    return this.bankAccountsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete bank account' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.bankAccountsService.delete(id);
  }
}
