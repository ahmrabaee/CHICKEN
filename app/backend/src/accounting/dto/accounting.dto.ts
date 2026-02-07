import { IsNumber, IsString, IsOptional, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty({ description: 'Account code (e.g., 1000, 2000)' })
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nameAr?: string;

  @ApiProperty({ enum: ['asset', 'liability', 'equity', 'revenue', 'expense'] })
  @IsString()
  accountType: string;
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class JournalEntryLineDto {
  @ApiProperty()
  @IsNumber()
  accountId: number;

  @ApiPropertyOptional({ description: 'Debit amount in minor units' })
  @IsNumber()
  @IsOptional()
  debit?: number;

  @ApiPropertyOptional({ description: 'Credit amount in minor units' })
  @IsNumber()
  @IsOptional()
  credit?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsString()
  @IsOptional()
  entryDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referenceType?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  referenceId?: number;

  @ApiProperty({ type: [JournalEntryLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalEntryLineDto)
  lines: JournalEntryLineDto[];
}
