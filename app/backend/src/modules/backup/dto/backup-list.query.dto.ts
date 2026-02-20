import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BackupListQueryDto {
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @ApiPropertyOptional({ enum: ['auto', 'manual'] })
    @IsOptional()
    @IsEnum(['auto', 'manual'])
    type?: 'auto' | 'manual';

    @ApiPropertyOptional({ enum: ['running', 'success', 'failed'] })
    @IsOptional()
    @IsEnum(['running', 'success', 'failed'])
    status?: 'running' | 'success' | 'failed';
}
