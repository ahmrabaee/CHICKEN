import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreditNoteService } from './credit-note.service';
import { Roles, CurrentUser } from '../../common';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';

@ApiTags('credit-notes')
@ApiBearerAuth('JWT-auth')
@Roles('admin', 'accountant')
@Controller('credit-notes')
export class CreditNoteController {
  constructor(private creditNoteService: CreditNoteService) {}

  @Get()
  @ApiOperation({ summary: 'List credit notes (Blueprint 04)' })
  findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('originalInvoiceType') originalInvoiceType?: string,
    @Query('originalInvoiceId') originalInvoiceId?: number,
  ) {
    return this.creditNoteService.findAll({
      page,
      pageSize,
      originalInvoiceType,
      originalInvoiceId: originalInvoiceId ? Number(originalInvoiceId) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get credit note by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.creditNoteService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create credit note (draft)' })
  create(@Body() body: CreateCreditNoteDto, @CurrentUser() user: { id: number }) {
    return this.creditNoteService.create(
      {
        originalInvoiceType: body.originalInvoiceType,
        originalInvoiceId: body.originalInvoiceId,
        amount: body.amount,
        reason: body.reason,
        branchId: body.branchId,
      },
      user.id,
    );
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit credit note (post GL + PLE)' })
  submit(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { id: number }) {
    return this.creditNoteService.submit(id, user.id);
  }
}
