import { IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
