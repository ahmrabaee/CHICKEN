import { IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWastageDto {
  @ApiProperty()
  @IsNumber()
  lotId: number;

  @ApiProperty({ description: 'Quantity in grams' })
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
