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
  Header,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseQueryDto } from './dto/expense.dto';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { Roles, CurrentUser } from '../common';

@ApiTags('expenses')
@ApiBearerAuth('JWT-auth')
@Controller('expenses')
export class ExpensesController {
  constructor(private expensesService: ExpensesService) { }

  @Get()
  @ApiOperation({ summary: 'List all expenses' })
  findAll(
    @Query() query: ExpenseQueryDto,
  ) {
    return this.expensesService.findAll(query, query.expenseType);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get expense categories' })
  getCategories() {
    return this.expensesService.getCategories();
  }

  @Get('report/pdf')
  @ApiOperation({ summary: 'Get expenses report as PDF' })
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=expenses-report.pdf')
  async getReportPdf(@Query() query: PdfQueryDto): Promise<StreamableFile> {
    const buffer = await this.expensesService.getExpenseReportPdf(query);
    return new StreamableFile(buffer);
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
