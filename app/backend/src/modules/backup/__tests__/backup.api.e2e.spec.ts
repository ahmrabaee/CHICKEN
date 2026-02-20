import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BackupController } from '../backup.controller';
import { BackupService } from '../backup.service';
import { BackupTokenService } from '../security/backup-token.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('Backup API - HTTP e2e', () => {
    let app: INestApplication;
    let baseUrl: string;
    let controller: BackupController;

    const backupService = {
        getConfig: vi.fn(),
        updateConfig: vi.fn(),
        getStatus: vi.fn(),
        listRuns: vi.fn(),
        runBackup: vi.fn(),
        createDownloadLink: vi.fn(),
        restoreBackup: vi.fn(),
        importBackup: vi.fn(),
        streamBackupFile: vi.fn(),
    };

    let tempFilePath = '';

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [BackupController],
            providers: [
                { provide: BackupService, useValue: backupService },
                { provide: BackupTokenService, useValue: {} },
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({
                transform: true,
                whitelist: true,
            }),
        );
        await app.init();
        await app.listen(0);

        controller = moduleRef.get(BackupController);
        (controller as any).backupService = backupService;
        (controller as any).tokenService = {};

        const address = app.getHttpServer().address();
        const port = typeof address === 'string' ? 0 : address.port;
        baseUrl = `http://127.0.0.1:${port}`;

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-api-e2e-'));
        tempFilePath = path.join(tempDir, 'backup.tar.gz');
        fs.writeFileSync(tempFilePath, Buffer.from('backup-content'));
    });

    afterAll(async () => {
        if (tempFilePath) {
            try {
                fs.rmSync(path.dirname(tempFilePath), { recursive: true, force: true });
            } catch {
                // ignore cleanup failures
            }
        }
        await app.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /system/backup/config', async () => {
        backupService.getConfig.mockResolvedValue({
            auto_enabled: true,
            schedule_time: '02:00',
        });

        const res = await fetch(`${baseUrl}/system/backup/config`);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).toMatchObject({
            auto_enabled: true,
            schedule_time: '02:00',
        });
    });

    it('PUT /system/backup/config', async () => {
        backupService.updateConfig.mockResolvedValue({
            auto_enabled: false,
            path_vps: './data/backups',
        });

        const res = await fetch(`${baseUrl}/system/backup/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auto_enabled: false }),
        });

        expect(res.status).toBe(200);
        expect(backupService.updateConfig).toHaveBeenCalledWith({ auto_enabled: false });
    });

    it('GET /system/backup/status', async () => {
        backupService.getStatus.mockResolvedValue({
            running: false,
            auto_enabled: true,
        });

        const res = await fetch(`${baseUrl}/system/backup/status`);
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ running: false, auto_enabled: true });
    });

    it('GET /system/backups', async () => {
        backupService.listRuns.mockResolvedValue({
            items: [],
            total: 0,
            page: 1,
            limit: 10,
        });

        const res = await fetch(`${baseUrl}/system/backups?page=1&limit=10`);
        expect(res.status).toBe(200);
        expect(backupService.listRuns).toHaveBeenCalledTimes(1);
        expect(backupService.listRuns).toHaveBeenCalledWith(
            expect.objectContaining({ page: '1', limit: '10' }),
        );
    });

    it('POST /system/backup', async () => {
        backupService.runBackup.mockResolvedValue(undefined);

        const res = await fetch(`${baseUrl}/system/backup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json).toMatchObject({ message: 'Backup started' });
        expect(backupService.runBackup).toHaveBeenCalledWith('manual');
    });

    it('POST /system/backups/:id/download-link', async () => {
        backupService.createDownloadLink.mockResolvedValue({
            url: 'http://download-url',
            expiresAt: new Date().toISOString(),
        });

        const res = await fetch(`${baseUrl}/system/backups/5/download-link`, { method: 'POST' });
        expect(res.status).toBe(201);
        expect(backupService.createDownloadLink).toHaveBeenCalledWith(
            5,
            expect.stringContaining(baseUrl),
        );
    });

    it('POST /system/backups/:id/restore', async () => {
        backupService.restoreBackup.mockResolvedValue({ message: 'ok' });

        const res = await fetch(`${baseUrl}/system/backups/5/restore`, { method: 'POST' });
        expect(res.status).toBe(201);
        expect(backupService.restoreBackup).toHaveBeenCalledWith(5);
    });

    it('POST /system/backups/import', async () => {
        backupService.importBackup.mockResolvedValue({ backupId: 9, restored: true });

        const form = new FormData();
        form.append('file', new Blob([Buffer.from('content')]), 'backup.tar.gz');
        form.append('restoreAfterImport', 'true');

        const res = await fetch(`${baseUrl}/system/backups/import`, {
            method: 'POST',
            body: form,
        });

        expect(res.status).toBe(201);
        expect(backupService.importBackup).toHaveBeenCalledWith(
            expect.any(Object),
            { restoreAfterImport: true },
        );
    });

    it('GET /system/backups/:id/download', async () => {
        backupService.streamBackupFile.mockResolvedValue({
            filePath: tempFilePath,
            filename: 'backup.tar.gz',
        });

        const res = await fetch(`${baseUrl}/system/backups/7/download?token=abc`);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('application/gzip');
        expect(res.headers.get('content-disposition')).toContain('backup.tar.gz');
        expect(backupService.streamBackupFile).toHaveBeenCalledWith(7, 'abc');

        const content = await res.text();
        expect(content).toBe('backup-content');
    });
});
