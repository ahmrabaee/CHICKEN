import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsEmail, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common';

export enum PriceLevel {
  STANDARD = 'standard',
  WHOLESALE = 'wholesale',
  VIP = 'vip',
}

export class CreateCustomerDto {
  @ApiProperty({ description: 'Customer name in Arabic', example: 'أحمد محمد' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Customer name in English', example: 'Ahmed Mohammed' })
  @IsString()
  @IsOptional()
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Primary phone number', example: '+966501234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Secondary phone number', example: '+966507654321' })
  @IsString()
  @IsOptional()
  phone2?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'ahmed@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Credit limit in minor units', example: 100000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  creditLimit?: number;

  @ApiPropertyOptional({
    description: 'Price level',
    enum: PriceLevel,
    default: PriceLevel.STANDARD,
  })
  @IsEnum(PriceLevel)
  @IsOptional()
  priceLevel?: PriceLevel;

  @ApiPropertyOptional({ description: 'Default discount in basis points (100 = 1%)', example: 500 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  @IsOptional()
  defaultDiscountPct?: number;

  @ApiPropertyOptional({ description: 'Tax number' })
  @IsString()
  @IsOptional()
  taxNumber?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @Type(() => Boolean)
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class CustomerListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, phone, or customer number' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Filter by price level', enum: PriceLevel })
  @IsEnum(PriceLevel)
  @IsOptional()
  priceLevel?: PriceLevel;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @Type(() => Boolean)
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter customers with outstanding balance' })
  @Type(() => Boolean)
  @IsOptional()
  hasBalance?: boolean;
}

export class CustomerResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'CUST0001' })
  customerNumber: string;

  @ApiProperty({ example: 'أحمد محمد' })
  name: string;

  @ApiPropertyOptional({ example: 'Ahmed Mohammed' })
  nameEn?: string;

  @ApiPropertyOptional({ example: '+966501234567' })
  phone?: string;

  @ApiPropertyOptional({ example: '+966507654321' })
  phone2?: string;

  @ApiPropertyOptional({ example: 'ahmed@example.com' })
  email?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiProperty({ example: 100000 })
  creditLimit: number;

  @ApiProperty({ example: 0 })
  currentBalance: number;

  @ApiProperty({ example: 'standard', enum: PriceLevel })
  priceLevel: string;

  @ApiProperty({ example: 0 })
  defaultDiscountPct: number;

  @ApiPropertyOptional()
  taxNumber?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
