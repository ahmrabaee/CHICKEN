import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsBoolean, MinLength } from 'class-validator';

export class CreateBankAccountDto {
  @ApiPropertyOptional({ description: 'Unique code (auto-generated if omitted)' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ description: 'Bank account name (e.g. بنك فلسطين)' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ description: 'English name' })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiPropertyOptional({ description: 'GL Account ID. Use 0 to auto-create a new account under 1112 (النقد في البنك)' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  accountId?: number;

  @ApiPropertyOptional({ description: 'Company ID (default 1)' })
  @IsOptional()
  @IsInt()
  companyId?: number;

  @ApiPropertyOptional({ description: 'Use as default for bank transfers', default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
