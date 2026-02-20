import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateBackupConfigDto {
    @ApiPropertyOptional({ description: 'Enable/disable automatic backups' })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    auto_enabled?: boolean;

    @ApiPropertyOptional({ description: 'Backup storage path on server' })
    @IsOptional()
    @IsString()
    path_vps?: string;
}
