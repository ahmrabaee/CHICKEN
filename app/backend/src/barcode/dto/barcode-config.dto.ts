import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BarcodeConfigDto {
  @ApiPropertyOptional({ description: 'Enable custom barcode' })
  @IsOptional()
  @IsBoolean()
  customEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Total barcode length (default 25)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  totalLength?: number;

  @ApiPropertyOptional({ description: 'Item code start position (0-based)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  itemCodeStart?: number;

  @ApiPropertyOptional({ description: 'Item code length' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  itemCodeLength?: number;

  @ApiPropertyOptional({ description: 'Weight start position' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  weightStart?: number;

  @ApiPropertyOptional({ description: 'Weight length (grams)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  weightLength?: number;

  @ApiPropertyOptional({ description: 'Total price with tax start position' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalPriceStart?: number;

  @ApiPropertyOptional({ description: 'Total price length' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  totalPriceLength?: number;

  @ApiPropertyOptional({ description: 'Price start position' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceStart?: number;

  @ApiPropertyOptional({ description: 'Price length' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  priceLength?: number;
}
