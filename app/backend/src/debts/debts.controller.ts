import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { getPdfContentDisposition } from '../pdf/pdf.helpers';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DebtsService } from './debts.service';
import { DebtQueryDto } from './dto/debt.dto';
import { Roles, RolesGuard, PageAccessGuard, RequirePageAccess } from '../common';

@ApiTags('debts')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
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

  @Get('receivables/pdf')
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'Download receivables report PDF' })
  async getReceivablesPdf(@Query() query: PdfQueryDto, @Res() res: Response) {
    const buffer = await this.debtsService.getReceivablesPdf(query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition('receivables-report.pdf', query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get('payables')
  @UseGuards(PageAccessGuard)
  @RequirePageAccess('/debts')
  @ApiOperation({ summary: 'List supplier payables (money we owe)' })
  findPayables(
    @Query() query: DebtQueryDto,
  ) {
    return this.debtsService.findPayables(query);
  }

  @Get('payables/pdf')
  @UseGuards(PageAccessGuard)
  @RequirePageAccess('/debts')
  @ApiOperation({ summary: 'Download payables report PDF' })
  async getPayablesPdf(@Query() query: PdfQueryDto, @Res() res: Response) {
    const buffer = await this.debtsService.getPayablesPdf(query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition('payables-report.pdf', query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get('summary')
  @UseGuards(PageAccessGuard)
  @RequirePageAccess('/debts')
  @ApiOperation({ summary: 'Get debts summary' })
  getSummary() {
    return this.debtsService.getSummary();
  }

  @Get('overdue')
  @UseGuards(PageAccessGuard)
  @RequirePageAccess('/debts')
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
