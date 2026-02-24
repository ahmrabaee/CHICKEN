import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsPositive, IsDateString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DailyPriceItemDto {
  @ApiProperty({ description: 'Item ID' })
  @IsInt()
  @IsPositive()
  itemId: number;

  @ApiProperty({ description: 'Price per kg in minor units' })
  @IsInt()
  @Min(0)
  pricePerKg: number;
}

export class SetDailyPricingDto {
  @ApiProperty({ description: 'Date (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ type: [DailyPriceItemDto], description: 'Prices per item' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyPriceItemDto)
  prices: DailyPriceItemDto[];
}

export class CopyFromYesterdayDto {
  @ApiProperty({ description: 'Target date (YYYY-MM-DD)' })
  @IsDateString()
  date: string;
}

export class DailyPriceResponseDto {
  @ApiProperty()
  itemId: number;

  @ApiProperty()
  itemName: string;

  @ApiPropertyOptional()
  itemNameEn?: string;

  @ApiProperty()
  pricePerKg: number;

  @ApiProperty()
  defaultSalePrice: number;
}

export class DailyPricingResponseDto {
  @ApiProperty()
  date: string;

  @ApiProperty({ type: [DailyPriceResponseDto] })
  items: DailyPriceResponseDto[];

  @ApiProperty({ description: 'Whether this date has any saved prices' })
  hasPrices: boolean;
}
