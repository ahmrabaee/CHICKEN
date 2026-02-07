import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBranchDto {
  @ApiProperty({ description: 'Branch code', example: 'BR001' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Branch name in Arabic', example: 'الفرع الرئيسي' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Branch name in English', example: 'Main Branch' })
  @IsString()
  @IsOptional()
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Address', example: 'الرياض، السعودية' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+966112345678' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Is main branch', default: false })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isMainBranch?: boolean;
}

export class UpdateBranchDto extends PartialType(CreateBranchDto) {}

export class BranchResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'BR001' })
  code: string;

  @ApiProperty({ example: 'الفرع الرئيسي' })
  name: string;

  @ApiPropertyOptional({ example: 'Main Branch' })
  nameEn?: string;

  @ApiPropertyOptional({ example: 'الرياض، السعودية' })
  address?: string;

  @ApiPropertyOptional({ example: '+966112345678' })
  phone?: string;

  @ApiProperty({ example: true })
  isMainBranch: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;
}
