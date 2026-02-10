import { IsNumber, IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common';

export class RecordSalePaymentDto {
  @ApiProperty()
  @IsNumber()
  saleId: number;

  @ApiProperty({ description: 'Amount in minor units (cents)' })
  @IsNumber()
  amount: number;

  @ApiProperty({ enum: ['cash', 'card', 'bank_transfer', 'mobile_payment'] })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RecordPurchasePaymentDto {
  @ApiProperty()
  @IsNumber()
  purchaseId: number;

  @ApiProperty({ description: 'Amount in minor units (cents)' })
  @IsNumber()
  amount: number;

  @ApiProperty({ enum: ['cash', 'card', 'bank_transfer', 'check'] })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class PaymentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['sale', 'purchase', 'debt'] })
  @IsString()
  @IsOptional()
  @IsIn(['sale', 'purchase', 'debt'])
  type?: string;
}
