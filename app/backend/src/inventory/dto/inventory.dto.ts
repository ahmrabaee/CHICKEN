import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class InventoryResponseDto {
  @ApiProperty() itemId: number;
  @ApiProperty() itemCode: string;
  @ApiProperty() itemName: string;
  @ApiProperty() categoryName: string;
  @ApiProperty() branchId: number;
  @ApiProperty() branchName: string;
  @ApiProperty() totalQuantity: number; // currentQuantityGrams
  @ApiProperty() availableQuantity: number; // availableQuantityGrams
  @ApiProperty() minStockLevel: number; // minStockLevelGrams
  @ApiProperty() avgCostPrice: number; // averageCostPerKg
  @ApiProperty() sellingPrice: number;
  @ApiProperty() unitOfMeasure: string;
  @ApiProperty() lotCount: number;
  @ApiPropertyOptional() lastRestockedAt?: string;
  @ApiPropertyOptional() lastSoldAt?: string;
  @ApiProperty() currentQuantityGrams: number;
  @ApiProperty() availableQuantityGrams: number;
}

export class InventoryLotResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() lotNumber: string;
  @ApiProperty() totalQuantity: number;
  @ApiProperty() remainingQuantity: number;
  @ApiProperty() unitPurchasePrice: number;
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

  @ApiPropertyOptional({ description: 'Branch ID (optional)' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  branchId?: number;
}

import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class InventoryQueryDto extends PaginationQueryDto {
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

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
}
