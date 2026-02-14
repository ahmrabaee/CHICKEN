import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsInt, IsPositive, IsString, IsOptional, IsIn, IsArray, ValidateNested,
  IsNotEmpty, IsDateString, Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common';

export class SaleLineDto {
  @ApiProperty({ description: 'Item ID' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  itemId: number;

  @ApiProperty({ description: 'Weight in grams' })
  @Transform(({ value }) => (typeof value === 'number' ? Math.round(value) : value))
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  weightGrams: number;

  @ApiProperty({ description: 'Price per kg in minor units' })
  @Transform(({ value }) => (typeof value === 'number' ? Math.round(value) : value))
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  pricePerKg: number;

  @ApiPropertyOptional({ description: 'Line discount in minor units' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  discountAmount?: number;
}

export class SalePaymentDto {
  @ApiProperty({ description: 'Payment amount in minor units' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Payment method', enum: ['cash', 'card', 'bank_transfer', 'mobile', 'check'] })
  @IsString()
  @IsIn(['cash', 'card', 'bank_transfer', 'mobile', 'check'])
  paymentMethod: string;
}

export class CreateSaleDto {
  @ApiPropertyOptional({ description: 'Customer ID (null for walk-in)' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  customerId?: number;

  @ApiPropertyOptional({ description: 'Customer name for walk-in' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiPropertyOptional({ description: 'Customer phone' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiProperty({ description: 'Sale type', enum: ['cash', 'credit', 'mixed'] })
  @IsString()
  @IsIn(['cash', 'credit', 'mixed'])
  saleType: string;

  @ApiPropertyOptional({ description: 'Discount amount in minor units' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'Discount percentage in basis points' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  discountPct?: number;

  @ApiPropertyOptional({ description: 'Due date for credit sales (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Tax template ID (Blueprint 05)' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  taxTemplateId?: number;

  @ApiProperty({ description: 'Sale line items', type: [SaleLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines: SaleLineDto[];

  @ApiPropertyOptional({ description: 'Payments', type: [SalePaymentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalePaymentDto)
  @IsOptional()
  payments?: SalePaymentDto[];
}

export class VoidSaleDto {
  @ApiProperty({ description: 'Reason for voiding' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class AddPaymentDto {
  @ApiProperty({ description: 'Payment amount in minor units' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Payment method', enum: ['cash', 'card', 'bank_transfer', 'mobile', 'check'] })
  @IsString()
  @IsIn(['cash', 'card', 'bank_transfer', 'mobile', 'check'])
  paymentMethod: string;

  @ApiPropertyOptional({ description: 'Receipt/reference number' })
  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'Payment notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class SaleLineResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() lineNumber: number;
  @ApiProperty() itemId: number;
  @ApiProperty() itemName: string;
  @ApiProperty() itemCode: string;
  @ApiProperty() weightGrams: number;
  @ApiProperty() pricePerKg: number;
  @ApiProperty() lineTotalAmount: number;
  @ApiProperty() costPerKg: number;
  @ApiProperty() lineTotalCost: number;
  @ApiProperty() lineProfit: number;
  @ApiPropertyOptional() costAllocations?: any[];
}

export class SaleResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() saleNumber: string;
  @ApiProperty() saleDate: string;
  @ApiProperty() saleType: string;
  @ApiPropertyOptional() customerId?: number;
  @ApiPropertyOptional() customerName?: string;
  @ApiProperty() grossTotalAmount: number;
  @ApiProperty() discountAmount: number;
  @ApiProperty() taxAmount: number;
  @ApiProperty() totalAmount: number;
  @ApiProperty() totalCost: number;
  @ApiProperty() totalProfit: number;
  @ApiProperty() paymentStatus: string;
  @ApiProperty() amountPaid: number;
  @ApiProperty() amountDue: number;
  @ApiProperty() isVoided: boolean;
  @ApiPropertyOptional() voidReason?: string;
  @ApiPropertyOptional() notes?: string;
  @ApiProperty() createdAt: string;
  @ApiPropertyOptional() lines?: SaleLineResponseDto[];
  @ApiPropertyOptional() payments?: any[];
}

export class SaleQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  customerId?: number;

  @ApiPropertyOptional({ enum: ['unpaid', 'partial', 'paid', 'voided'] })
  @IsString()
  @IsOptional()
  paymentStatus?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
