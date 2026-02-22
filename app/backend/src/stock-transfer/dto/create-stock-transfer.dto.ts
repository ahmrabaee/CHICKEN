import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsPositive, IsOptional, IsString, IsDateString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class StockTransferLineDto {
  @ApiProperty({ description: 'Item ID (target product)' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  itemId: number;

  @ApiProperty({ description: 'Weight in grams' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weightGrams: number;

  @ApiProperty({ description: 'Unit cost in minor units per kg' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitCost: number;

  @ApiPropertyOptional({ description: 'Line number (auto if omitted)' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  lineNumber?: number;
}

export class CreateStockTransferDto {
  @ApiProperty({ description: 'Source lot ID (raw chicken lot)' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  sourceLotId: number;

  @ApiProperty({ description: 'Expiry date for the converted products (ISO date)' })
  @IsDateString()
  expiryDate: string;

  @ApiPropertyOptional({ description: 'Branch ID' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  branchId?: number;

  @ApiProperty({ type: [StockTransferLineDto], description: 'Distribution to products' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTransferLineDto)
  lines: StockTransferLineDto[];

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
