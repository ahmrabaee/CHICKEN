import { IsNumber, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWastageDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  lotId: number;

  @ApiProperty({ description: 'Quantity in grams' })
  @Type(() => Number)
  @IsNumber()
  quantityGrams: number;

  @ApiProperty({ enum: ['expired', 'damaged', 'spoiled', 'processing_loss', 'other'] })
  @IsString()
  reason: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
