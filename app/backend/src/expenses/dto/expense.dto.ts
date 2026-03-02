import { IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common';

export class CreateExpenseDto {
  @ApiProperty({ description: 'ID of the expense category (from /expenses/categories)' })
  @IsNumber()
  categoryId: number;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ description: 'Amount in minor units (cents)' })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ description: 'Tax amount in minor units (cents)' })
  @IsNumber()
  @IsOptional()
  taxAmount?: number;

  @ApiPropertyOptional({ description: 'ISO date string (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  expenseDate?: string;

  @ApiPropertyOptional({ enum: ['operational', 'personal', 'payroll', 'utilities', 'rent', 'maintenance', 'other'] })
  @IsString()
  @IsOptional()
  expenseType?: string;

  @ApiPropertyOptional({ enum: ['cash', 'card', 'bank_transfer', 'check', 'credit'] })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Supplier ID (optional)' })
  @IsNumber()
  @IsOptional()
  supplierId?: number;

  @ApiPropertyOptional({ description: 'Branch ID (optional)' })
  @IsNumber()
  @IsOptional()
  branchId?: number;

  @ApiPropertyOptional({ description: 'Bank account ID (for bank_transfer)' })
  @IsNumber()
  @IsOptional()
  bankAccountId?: number;

  @ApiPropertyOptional({ description: 'Receipt / reference number' })
  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  attachmentUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) { }

export class ExpenseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  expenseType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  endDate?: string;
}
