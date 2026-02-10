import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DebtsService } from './debts.service';
import { DebtQueryDto } from './dto/debt.dto';
import { Roles } from '../common';

@ApiTags('debts')
@ApiBearerAuth('JWT-auth')
@Controller('debts')
export class DebtsController {
  constructor(private debtsService: DebtsService) { }

  @Get('receivables')
  @ApiOperation({ summary: 'List customer receivables (money owed to us)' })
  findReceivables(
    @Query() query: DebtQueryDto,
  ) {
    return this.debtsService.findReceivables(query);
  }

  @Get('payables')
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List supplier payables (money we owe)' })
  findPayables(
    @Query() query: DebtQueryDto,
  ) {
    return this.debtsService.findPayables(query);
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
