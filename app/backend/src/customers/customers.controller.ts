import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, ParseIntPipe, HttpCode, HttpStatus, UseGuards, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerResponseDto, CustomerListQueryDto } from './dto';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { getPdfContentDisposition } from '../pdf/pdf.helpers';
import { Roles, RolesGuard, CurrentUser, CurrentUserData, PaginatedResult } from '../common';

@ApiTags('customers')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) { }

  @Get()
  @Roles('admin', 'cashier')
  @ApiOperation({ summary: 'List all customers with filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of customers' })
  async findAll(@Query() query: CustomerListQueryDto): Promise<PaginatedResult<CustomerResponseDto>> {
    return this.customersService.findAll(query);
  }

  @Get('search')
  @Roles('admin', 'cashier')
  @ApiOperation({ summary: 'Search customers by name, phone, or customer number' })
  @ApiQuery({ name: 'q', description: 'Search term' })
  @ApiResponse({ status: 200, type: [CustomerResponseDto] })
  async search(@Query('q') searchTerm: string): Promise<CustomerResponseDto[]> {
    return this.customersService.search(searchTerm || '');
  }

  @Get(':id')
  @Roles('admin', 'cashier')
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  async findById(@Param('id', ParseIntPipe) id: number): Promise<CustomerResponseDto> {
    return this.customersService.findById(id);
  }

  @Get('number/:customerNumber')
  @Roles('admin', 'cashier')
  @ApiOperation({ summary: 'Get customer by customer number' })
  @ApiParam({ name: 'customerNumber', description: 'Customer number' })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  async findByCustomerNumber(@Param('customerNumber') customerNumber: string): Promise<CustomerResponseDto> {
    return this.customersService.findByCustomerNumber(customerNumber);
  }

  @Get('phone/:phone')
  @Roles('admin', 'cashier')
  @ApiOperation({ summary: 'Get customer by phone number' })
  @ApiParam({ name: 'phone', description: 'Phone number' })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  async findByPhone(@Param('phone') phone: string): Promise<CustomerResponseDto> {
    return this.customersService.findByPhone(phone);
  }

  @Get(':id/statement/pdf')
  @ApiOperation({ summary: 'Download customer statement PDF' })
  async getStatementPdf(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PdfQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.customersService.getStatementPdf(id, query);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': getPdfContentDisposition(`statement-customer-${id}.pdf`, query.inline),
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Post()
  @Roles('admin', 'cashier')
  @ApiOperation({ summary: 'Create customer' })
  @ApiResponse({ status: 201, type: CustomerResponseDto })
  async create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<CustomerResponseDto> {
    return this.customersService.create(dto, user?.id);
  }

  @Put(':id')
  @Roles('admin', 'cashier')
  @ApiOperation({ summary: 'Update customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiResponse({ status: 200, type: CustomerResponseDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<CustomerResponseDto> {
    return this.customersService.update(id, dto, user?.id);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete or deactivate customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.customersService.delete(id);
  }
}
