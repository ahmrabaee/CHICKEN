import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCreditNoteDto {
  @ApiProperty({ enum: ['sale', 'purchase'] })
  @IsIn(['sale', 'purchase'])
  originalInvoiceType: 'sale' | 'purchase';

  @ApiProperty({ description: 'Original invoice ID' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  originalInvoiceId: number;

  @ApiProperty({ description: 'Amount in minor units (cents)' })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  branchId?: number;
}
