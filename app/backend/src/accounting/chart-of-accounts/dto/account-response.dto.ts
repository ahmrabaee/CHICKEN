import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccountResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  nameEn?: string | null;

  @ApiProperty()
  rootType: string;

  @ApiProperty()
  reportType: string;

  @ApiProperty()
  accountType: string;

  @ApiPropertyOptional()
  parentId?: number | null;

  @ApiProperty()
  lft: number;

  @ApiProperty()
  rgt: number;

  @ApiProperty()
  isGroup: boolean;

  @ApiPropertyOptional()
  balanceMustBe?: string | null;

  @ApiPropertyOptional()
  accountCurrency?: string | null;

  @ApiPropertyOptional()
  companyId?: number | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isSystemAccount: boolean;

  @ApiProperty()
  freezeAccount: boolean;

  @ApiPropertyOptional()
  parent?: { id: number; code: string; name: string } | null;

  @ApiPropertyOptional()
  childAccounts?: { id: number; code: string; name: string }[];
}
