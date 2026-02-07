import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category code', example: 'CHICKEN_FRESH' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Category name in Arabic', example: 'دجاج طازج' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Category name in English', example: 'Fresh Chicken' })
  @IsString()
  @IsOptional()
  nameEn?: string;

  @ApiPropertyOptional({ description: 'Display order', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Icon name or path', example: 'chicken-icon' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Default shelf life in days', example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  defaultShelfLifeDays?: number;

  @ApiPropertyOptional({
    description: 'Storage type',
    example: 'fresh',
    enum: ['fresh', 'frozen', 'processed'],
  })
  @IsString()
  @IsOptional()
  storageType?: string;

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CategoryResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'CHICKEN_FRESH' })
  code: string;

  @ApiProperty({ example: 'دجاج طازج' })
  name: string;

  @ApiPropertyOptional({ example: 'Fresh Chicken' })
  nameEn?: string;

  @ApiProperty({ example: 1 })
  displayOrder: number;

  @ApiPropertyOptional({ example: 'chicken-icon' })
  icon?: string;

  @ApiPropertyOptional({ example: 3 })
  defaultShelfLifeDays?: number;

  @ApiPropertyOptional({ example: 'fresh' })
  storageType?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
