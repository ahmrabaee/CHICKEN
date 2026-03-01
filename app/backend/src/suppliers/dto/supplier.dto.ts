import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nameEn?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactPerson?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  taxNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  creditLimit?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bankAccountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  rating?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
