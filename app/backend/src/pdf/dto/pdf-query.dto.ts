
import { IsIn, IsISO8601, IsOptional, IsString, IsNumberString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PdfQueryDto {
    @ApiPropertyOptional({ enum: ['en', 'ar'], default: 'en', description: 'Language of the report' })
    @IsOptional()
    @IsIn(['en', 'ar'])
    language?: 'en' | 'ar' = 'en';

    @ApiPropertyOptional({ description: 'Start date for period reports (ISO 8601)' })
    @IsOptional()
    @IsISO8601()
    startDate?: string;

    @ApiPropertyOptional({ description: 'End date for period reports (ISO 8601)' })
    @IsOptional()
    @IsISO8601()
    endDate?: string;

    @ApiPropertyOptional({ description: 'As of date for snapshot reports' })
    @IsOptional()
    @IsISO8601()
    asOfDate?: string;

    @ApiPropertyOptional({ description: 'Filter by branch ID' })
    @IsOptional()
    @IsNumberString()
    branchId?: string;
}
