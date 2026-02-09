import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DebtsService } from './debts.service';
import { PaginationQueryDto, Roles } from '../common';

@ApiTags('debts')
@ApiBearerAuth('JWT-auth')
@Controller('debts')
export class DebtsController {
  constructor(private debtsService: DebtsService) {}

  @Get('receivables')
  @ApiOperation({ summary: 'List customer receivables (money owed to us)' })
  @ApiQuery({ name: 'customerId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'partial', 'paid', 'overdue'] })
  findReceivables(
    @Query() pagination: PaginationQueryDto,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    return this.debtsService.findReceivables(pagination);
  }

  @Get('payables')
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List supplier payables (money we owe)' })
  @ApiQuery({ name: 'supplierId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'partial', 'paid', 'overdue'] })
  findPayables(
    @Query() pagination: PaginationQueryDto,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
  ) {
    return this.debtsService.findPayables(pagination);
  }

  @Get('summary')
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get debts summary' })
  getSummary() {
    return this.debtsService.getSummary();
  }

  @Get('overdue')
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get overdue debts' })
  getOverdue() {
    return this.debtsService.getOverdue();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get debt by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.debtsService.findById(id);
  }
}
