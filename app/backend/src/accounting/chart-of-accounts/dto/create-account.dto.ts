import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ROOT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'] as const;
const REPORT_TYPES = ['Balance Sheet', 'Profit and Loss'] as const;
const ACCOUNT_TYPES = [
  'Bank',
  'Cash',
  'Receivable',
  'Payable',
  'Stock',
  'Fixed Asset',
  'Cost of Goods Sold',
  'Expense Account',
  'Income Account',
  'Tax',
  'Round Off',
  'Current Asset',
  'Current Liability',
  'Equity',
  'Liability',
  'Direct Income',
  'Indirect Income',
  'Direct Expense',
  'Indirect Expense',
  'Stock Adjustment',
  'Other',
] as const;

export class CreateAccountDto {
  @ApiProperty({ description: 'Account code (e.g., 1000, 2110)' })
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nameEn?: string;

  @ApiPropertyOptional({ enum: ROOT_TYPES, description: 'Auto-derived from accountType if omitted' })
  @IsString()
  @IsOptional()
  rootType?: (typeof ROOT_TYPES)[number];

  @ApiPropertyOptional({ enum: REPORT_TYPES, description: 'Auto-derived from rootType if omitted' })
  @IsString()
  @IsOptional()
  reportType?: (typeof REPORT_TYPES)[number];

  @ApiProperty({ enum: ACCOUNT_TYPES })
  @IsString()
  accountType: (typeof ACCOUNT_TYPES)[number];

  @ApiPropertyOptional({ description: 'Parent account ID' })
  @IsNumber()
  @IsOptional()
  parentId?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isGroup?: boolean;

  @ApiPropertyOptional({ enum: ['Debit', 'Credit'] })
  @IsString()
  @IsOptional()
  balanceMustBe?: 'Debit' | 'Credit' | null;

  @ApiPropertyOptional({ default: 'SAR' })
  @IsString()
  @IsOptional()
  accountCurrency?: string | null;
}
