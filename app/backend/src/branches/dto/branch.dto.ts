import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, Matches, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBranchDto {
  @ApiProperty({ description: 'Branch code (2-10 chars, uppercase)', example: 'BR01' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message: 'Code must be 2-10 uppercase alphanumeric characters',
  })
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

  @ApiPropertyOptional({ description: 'Branch has a weight scale', default: true })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  hasScale?: boolean;

  @ApiPropertyOptional({ description: 'Scale COM port (required if hasScale is true)', example: 'COM3' })
  @IsString()
  @IsOptional()
  @Matches(/^COM[1-9][0-9]?$/, {
    message: 'Scale COM port must be in format COM1 to COM99',
  })
  @ValidateIf((o) => o.hasScale === true)
  scaleComPort?: string;

  @ApiPropertyOptional({ description: 'Stock account ID (Blueprint 06)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stockAccountId?: number;
}

// Update DTO excludes code and isMainBranch - these cannot be changed
export class UpdateBranchDto extends PartialType(
  OmitType(CreateBranchDto, ['code'] as const),
) {}

export class BranchResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'BR01' })
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
  hasScale: boolean;

  @ApiPropertyOptional({ example: 'COM3' })
  scaleComPort?: string;

  @ApiProperty({ example: true })
  isMainBranch: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Stock account ID (Blueprint 06)' })
  stockAccountId?: number | null;

  @ApiPropertyOptional({ description: 'Stock account details' })
  stockAccount?: { id: number; code: string; name: string };

  @ApiProperty({ example: 3, description: 'Number of users assigned to this branch' })
  userCount: number;

  @ApiProperty({ example: '2026-02-07T10:00:00.000Z' })
  createdAt: string;
}

export class BranchListResponseDto {
  @ApiProperty({ type: [BranchResponseDto] })
  branches: BranchResponseDto[];
}
