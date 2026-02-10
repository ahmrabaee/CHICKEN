import { IsOptional, IsString, IsInt, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common';

export class DebtQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional()
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    customerId?: number;

    @ApiPropertyOptional()
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    supplierId?: number;

    @ApiPropertyOptional({ enum: ['open', 'partial', 'paid', 'overdue', 'written_off'] })
    @IsString()
    @IsOptional()
    @IsIn(['open', 'partial', 'paid', 'overdue', 'written_off'])
    status?: string;
}
