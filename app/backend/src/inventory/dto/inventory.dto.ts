import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class InventoryResponseDto {
  @ApiProperty() itemId: number;
  @ApiProperty() itemCode: string;
  @ApiProperty() itemName: string;
  @ApiProperty({ description: 'Current quantity in grams' }) currentQuantityGrams: number;
  @ApiProperty() reservedQuantityGrams: number;
  @ApiProperty() availableQuantityGrams: number;
  @ApiProperty({ description: 'Total value in minor units' }) totalValue: number;
  @ApiProperty({ description: 'Average cost per kg in minor units' }) averageCostPerKg: number;
  @ApiProperty() minStockLevelGrams: number;
  @ApiPropertyOptional() lastRestockedAt?: string;
  @ApiPropertyOptional() lastSoldAt?: string;
  @ApiProperty() lotCount: number;
}

export class InventoryLotResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() lotNumber: string;
  @ApiProperty() totalQuantityGrams: number;
  @ApiProperty() remainingQuantityGrams: number;
  @ApiProperty({ description: 'Purchase price per kg in minor units' }) unitPurchasePricePerKg: number;
  @ApiProperty() receivedAt: string;
  @ApiPropertyOptional() expiryDate?: string;
  @ApiPropertyOptional() purchaseNumber?: string;
}

export class StockMovementResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() itemId: number;
  @ApiProperty() movementType: string;
  @ApiProperty() quantityGrams: number;
  @ApiProperty() costPerKgMinor: number;
  @ApiProperty() referenceType: string;
  @ApiProperty() referenceId: number;
  @ApiPropertyOptional() notes?: string;
  @ApiProperty() createdAt: string;
}

export class CreateAdjustmentDto {
  @ApiProperty({ description: 'Item ID' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  itemId: number;

  @ApiPropertyOptional({ description: 'Specific lot ID (optional)' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  lotId?: number;

  @ApiProperty({ description: 'Adjustment type', enum: ['increase', 'decrease'] })
  @IsString()
  @IsIn(['increase', 'decrease'])
  adjustmentType: string;

  @ApiProperty({ description: 'Quantity in grams' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantityGrams: number;

  @ApiProperty({ description: 'Reason for adjustment' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ description: 'Unit cost for increases (minor units per kg)' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  unitCost?: number;
}

export class InventoryQueryDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  branchId?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Only items below minimum stock' })
  @Type(() => Boolean)
  @IsOptional()
  lowStock?: boolean;
}
