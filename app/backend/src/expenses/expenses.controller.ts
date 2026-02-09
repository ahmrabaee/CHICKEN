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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { PaginationQueryDto, Roles, CurrentUser } from '../common';

@ApiTags('expenses')
@ApiBearerAuth('JWT-auth')
@Controller('expenses')
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  @Get()
  @ApiOperation({ summary: 'List all expenses' })
  @ApiQuery({ name: 'expenseType', required: false })
  findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('expenseType') expenseType?: string,
  ) {
    return this.expensesService.findAll(pagination, expenseType);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get expense categories' })
  getCategories() {
    return this.expensesService.getCategories();
  }

  @Get('summary')
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get expenses summary by type' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getSummary(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.expensesService.getSummaryByType(startDate, endDate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.expensesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new expense' })
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: any) {
    return this.expensesService.create(dto, user.id);
  }

  @Put(':id')
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Update expense' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpenseDto, @CurrentUser() user: any) {
    return this.expensesService.update(id, dto, user.id);
  }

  @Post(':id/approve')
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Approve expense' })
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.expensesService.approve(id, user.id);
  }

  @Delete(':id')
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Delete expense' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.expensesService.delete(id);
  }
}
