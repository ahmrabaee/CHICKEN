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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto, ExpenseQueryDto } from './dto/expense.dto';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { getPdfContentDisposition } from '../pdf/pdf.helpers';
import { RolesGuard, PageAccessGuard, RequirePageAccess, CurrentUser } from '../common';

@ApiTags('expenses')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard, PageAccessGuard)
@RequirePageAccess('/expenses')
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
  async getReportPdf(@Query() query: PdfQueryDto, @Res() res: Response) {
    const buffer = await this.expensesService.getExpenseReportPdf(query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition('expenses-report.pdf', query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get('summary')
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
  @ApiOperation({ summary: 'Update expense' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpenseDto, @CurrentUser() user: any) {
    return this.expensesService.update(id, dto, user.id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve expense' })
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.expensesService.approve(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete expense' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.expensesService.delete(id);
  }
}
