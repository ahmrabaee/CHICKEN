import { IsNumber, IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common';

export class CreateExpenseDto {
  @ApiProperty({ enum: ['utilities', 'rent', 'salaries', 'maintenance', 'supplies', 'transport', 'marketing', 'other'] })
  @IsString()
  category: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ description: 'Amount in minor units (cents)' })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsString()
  @IsOptional()
  expenseDate?: string;

  @ApiPropertyOptional({ enum: ['cash', 'card', 'bank_transfer'] })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'True for personal/owner expenses' })
  @IsBoolean()
  @IsOptional()
  isPersonal?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  receiptNumber?: string;

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
}
