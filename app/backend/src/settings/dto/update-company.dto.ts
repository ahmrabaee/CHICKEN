import { IsOptional, IsString, Allow } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCompanyDto {
    @ApiPropertyOptional()
    @Allow()
    roundOffAccountId?: number | null;

    @ApiPropertyOptional()
    @Allow()
    roundOffCostCenterId?: number | null;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    nameEn?: string;
}
