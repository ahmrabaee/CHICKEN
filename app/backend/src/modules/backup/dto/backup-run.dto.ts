import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBackupDto {
    @ApiPropertyOptional({ example: 'db+assets', description: 'Backup scope' })
    @IsOptional()
    @IsString()
    scope?: string;
}
