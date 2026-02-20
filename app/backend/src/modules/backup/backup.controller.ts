import {
    Controller,
    Get,
    Post,
    Put,
    Param,
    Body,
    Query,
    Res,
    ParseIntPipe,
    Req,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { Request, Response } from 'express';
import * as fs from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { BackupService } from './backup.service';
import { BackupTokenService } from './security/backup-token.service';
import { UpdateBackupConfigDto } from './dto/backup-config.dto';
import { CreateBackupDto } from './dto/backup-run.dto';
import { BackupListQueryDto } from './dto/backup-list.query.dto';
import { Roles } from '../../common';
import { Public } from '../../common';

type UploadedBackupFile = {
    originalname?: string;
    buffer?: Buffer;
    size?: number;
    path?: string;
};

@ApiTags('backup')
@ApiBearerAuth('JWT-auth')
@Controller('system')
export class BackupController {
    constructor(
        private backupService: BackupService,
        private tokenService: BackupTokenService,
    ) { }

    // ─── Config ──────────────────────────────────────────────────────────────────

    @Get('backup/config')
    @Roles('admin')
    @ApiOperation({ summary: 'Get backup configuration' })
    getConfig() {
        return this.backupService.getConfig();
    }

    @Put('backup/config')
    @Roles('admin')
    @ApiOperation({ summary: 'Update backup configuration' })
    updateConfig(@Body() dto: UpdateBackupConfigDto) {
        return this.backupService.updateConfig(dto);
    }

    // ─── Status ──────────────────────────────────────────────────────────────────

    @Get('backup/status')
    @Roles('admin')
    @ApiOperation({ summary: 'Get current backup status' })
    getStatus() {
        return this.backupService.getStatus();
    }

    // ─── List ─────────────────────────────────────────────────────────────────────

    @Get('backups')
    @Roles('admin')
    @ApiOperation({ summary: 'List backup runs' })
    listRuns(@Query() query: BackupListQueryDto) {
        return this.backupService.listRuns(query);
    }

    // ─── Manual Trigger ───────────────────────────────────────────────────────────

    @Post('backup')
    @Roles('admin')
    @ApiOperation({ summary: 'Trigger a manual backup' })
    async createBackup(@Body() dto: CreateBackupDto) {
        // Run async – don't await so the response returns immediately
        this.backupService.runBackup('manual').catch(() => {
            // Errors are logged inside the service
        });
        return { message: 'Backup started', messageAr: 'بدأ النسخ الاحتياطي' };
    }

    // ─── Download Link ────────────────────────────────────────────────────────────

    @Post('backups/:id/download-link')
    @Roles('admin')
    @ApiOperation({ summary: 'Generate a signed download link (5 min TTL)' })
    async createDownloadLink(
        @Param('id', ParseIntPipe) id: number,
        @Req() req: Request,
    ) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        return this.backupService.createDownloadLink(id, baseUrl);
    }

    @Post('backups/:id/restore')
    @Roles('admin')
    @ApiOperation({ summary: 'Restore a specific backup archive' })
    async restoreBackup(@Param('id', ParseIntPipe) id: number) {
        return this.backupService.restoreBackup(id);
    }

    @Post('backups/import')
    @Roles('admin')
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
                restoreAfterImport: {
                    type: 'boolean',
                    description: 'Restore this backup immediately after import',
                },
            },
            required: ['file'],
        },
    })
    @ApiOperation({ summary: 'Import a backup archive into backup storage' })
    async importBackup(
        @UploadedFile() file?: UploadedBackupFile,
        @Body('restoreAfterImport') restoreAfterImport?: string | boolean,
    ) {
        const shouldRestore =
            restoreAfterImport === true ||
            restoreAfterImport === 'true' ||
            restoreAfterImport === '1';

        return this.backupService.importBackup(file, {
            restoreAfterImport: shouldRestore,
        });
    }

    // ─── Download File ────────────────────────────────────────────────────────────

    @Get('backups/:id/download')
    @Public()
    @ApiOperation({ summary: 'Download backup file using signed token' })
    async downloadBackup(
        @Param('id', ParseIntPipe) id: number,
        @Query('token') token: string,
        @Res() res: Response,
    ) {
        const { filePath, filename } = await this.backupService.streamBackupFile(id, token);

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/gzip');

        const stat = fs.statSync(filePath);
        res.setHeader('Content-Length', stat.size);

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    }
}
