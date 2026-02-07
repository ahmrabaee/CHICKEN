import { ApiProperty, ApiPropertyOptional, PartialType, IntersectionType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common';

export class CreateItemDto {
  @ApiProperty({ description: 'Item code', example: 'CHK001' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: 'Barcode', example: '1234567890123' })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiProperty({ description: 'Item name in Arabic', example: 'دجاج كامل' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Item name in English', example: 'Whole Chicken' })
  @IsString()
  @IsOptional()
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Item description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Category ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  categoryId: number;

  @ApiProperty({ description: 'Default sale price per kg (minor units)', example: 1500 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultSalePrice: number;

  @ApiPropertyOptional({ description: 'Default purchase price per kg (minor units)', example: 1200 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  defaultPurchasePrice?: number;

  @ApiPropertyOptional({ description: 'Tax rate in basis points (100 = 1%)', example: 1500 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  @IsOptional()
  taxRatePct?: number;

  @ApiPropertyOptional({ description: 'Minimum stock level in grams', example: 5000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  minStockLevelGrams?: number;

  @ApiPropertyOptional({ description: 'Maximum stock level in grams', example: 50000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  maxStockLevelGrams?: number;

  @ApiPropertyOptional({ description: 'Shelf life in days', example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  shelfLifeDays?: number;

  @ApiPropertyOptional({ description: 'Storage location', enum: ['fridge', 'freezer', 'display'] })
  @IsString()
  @IsOptional()
  storageLocation?: string;

  @ApiPropertyOptional({ description: 'Requires scale for weighing', default: true })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  requiresScale?: boolean;

  @ApiPropertyOptional({ description: 'Allow negative stock', default: false })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  allowNegativeStock?: boolean;

  @ApiPropertyOptional({ description: 'Image URL' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateItemDto extends PartialType(CreateItemDto) {}

export class ItemListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, code, or barcode' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Filter items with low stock' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  lowStock?: boolean;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ItemInventorySummaryDto {
  @ApiProperty({ example: 15000 })
  currentQuantityGrams: number;

  @ApiProperty({ example: 0 })
  reservedQuantityGrams: number;

  @ApiProperty({ example: 18000 })
  totalValue: number;

  @ApiProperty({ example: 1200 })
  averageCost: number;
}

export class ItemResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'CHK001' })
  code: string;

  @ApiPropertyOptional({ example: '1234567890123' })
  barcode?: string;

  @ApiProperty({ example: 'دجاج كامل' })
  name: string;

  @ApiPropertyOptional({ example: 'Whole Chicken' })
  nameEn?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ example: 1 })
  categoryId: number;

  @ApiProperty({ example: 1500 })
  defaultSalePrice: number;

  @ApiPropertyOptional({ example: 1200 })
  defaultPurchasePrice?: number;

  @ApiPropertyOptional({ example: 1500 })
  taxRatePct?: number;

  @ApiPropertyOptional({ example: 5000 })
  minStockLevelGrams?: number;

  @ApiPropertyOptional({ example: 50000 })
  maxStockLevelGrams?: number;

  @ApiPropertyOptional({ example: 3 })
  shelfLifeDays?: number;

  @ApiPropertyOptional({ example: 'fridge' })
  storageLocation?: string;

  @ApiProperty({ example: true })
  requiresScale: boolean;

  @ApiProperty({ example: false })
  allowNegativeStock: boolean;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ type: ItemInventorySummaryDto })
  inventory?: ItemInventorySummaryDto;

  @ApiPropertyOptional()
  category?: {
    id: number;
    code: string;
    name: string;
    nameEn?: string;
  };

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
