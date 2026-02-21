import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsArray, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePageAccessDto {
  @ApiProperty({ example: 2, description: 'User ID' })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 'debts' })
  @IsString()
  pageKey: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  allowed: boolean;
}

export class BulkUpdatePageAccessDto {
  @ApiProperty({ type: [UpdatePageAccessDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePageAccessDto)
  items: UpdatePageAccessDto[];
}

export class PageAccessItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  key: string;

  @ApiProperty()
  path: string;

  @ApiProperty()
  titleAr: string;

  @ApiPropertyOptional()
  titleEn?: string;

  @ApiPropertyOptional()
  groupKey?: string;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty({ example: true })
  allowed: boolean;
}

export class UserPageAccessResponseDto {
  @ApiProperty({ type: [PageAccessItemDto] })
  pages: PageAccessItemDto[];
}

export class AccountantUserDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiProperty()
  fullName: string;

  @ApiPropertyOptional()
  fullNameEn?: string;

  @ApiProperty()
  role: string;
}

export class AccountantListResponseDto {
  @ApiProperty({ type: [AccountantUserDto] })
  users: AccountantUserDto[];
}
