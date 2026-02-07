import { IsNumber, IsArray, IsOptional, IsString, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class PurchaseLineDto {
  @ApiProperty()
  @IsNumber()
  itemId: number;

  @ApiProperty({ description: 'Weight in grams' })
  @IsNumber()
  weightGrams: number;

  @ApiProperty({ description: 'Price per kg in minor units (cents)' })
  @IsNumber()
  pricePerKg: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isLiveBird?: boolean;
}

export class CreatePurchaseDto {
  @ApiProperty()
  @IsNumber()
  supplierId: number;

  @ApiProperty({ type: [PurchaseLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines: PurchaseLineDto[];

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsString()
  @IsOptional()
  purchaseDate?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Tax in minor units' })
  @IsNumber()
  @IsOptional()
  taxAmount?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReceiveLineDto {
  @ApiProperty()
  @IsNumber()
  purchaseLineId: number;

  @ApiProperty({ description: 'Received weight in grams' })
  @IsNumber()
  receivedWeightGrams: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  lotNumber?: string;
}

export class ReceivePurchaseDto {
  @ApiProperty({ type: [ReceiveLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines: ReceiveLineDto[];
}

export class UpdatePurchaseDto extends PartialType(CreatePurchaseDto) {}
