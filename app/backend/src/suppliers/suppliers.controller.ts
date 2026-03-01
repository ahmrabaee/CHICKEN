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
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { getPdfContentDisposition } from '../pdf/pdf.helpers';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { PaginationQueryDto, Roles, RolesGuard } from '../common';

export class SuppliersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}

@ApiTags('suppliers')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Roles('admin')
@Controller('suppliers')
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) { }

  @Get()
  @ApiOperation({ summary: 'List all suppliers' })
  findAll(@Query() query: SuppliersQueryDto) {
    return this.suppliersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get supplier by ID' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.findById(id);
  }

  @Get(':id/statement/pdf')
  @ApiOperation({ summary: 'Download supplier statement PDF' })
  async getStatementPdf(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PdfQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.suppliersService.getStatementPdf(id, query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition(`statement-supplier-${id}.pdf`, query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Post()
  @ApiOperation({ summary: 'Create new supplier' })
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update supplier' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete supplier' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.suppliersService.delete(id);
  }
}
