import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { once } from 'events';
import { PassThrough } from 'stream';
import { BackupController } from '../backup.controller';

describe('BackupController', () => {
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

    const tokenService = {
        createToken: vi.fn(),
        verifyToken: vi.fn(),
    };

    let controller: BackupController;
    let tempDirs: string[] = [];

    function createTempDir(prefix: string): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
        tempDirs.push(dir);
        return dir;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        controller = new BackupController(backupService as any, tokenService as any);
    });

    afterEach(() => {
        for (const dir of tempDirs) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch {
                // ignore cleanup failures
            }
        }
        tempDirs = [];
    });

    it('delegates config/status/list operations to service', async () => {
        backupService.getConfig.mockResolvedValue({ auto_enabled: true });
        backupService.getStatus.mockResolvedValue({ running: false });
        backupService.listRuns.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 });

        await controller.getConfig();
        await controller.getStatus();
        await controller.listRuns({ page: 1, limit: 10 } as any);

        expect(backupService.getConfig).toHaveBeenCalledTimes(1);
        expect(backupService.getStatus).toHaveBeenCalledTimes(1);
        expect(backupService.listRuns).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it('createBackup starts manual backup in fire-and-forget mode', async () => {
        backupService.runBackup.mockResolvedValue(undefined);

        const result = await controller.createBackup({} as any);

        expect(backupService.runBackup).toHaveBeenCalledWith('manual');
        expect(result).toEqual(
            expect.objectContaining({
                message: 'Backup started',
                messageAr: expect.any(String),
            }),
        );
    });

    it('createDownloadLink builds base URL from request', async () => {
        backupService.createDownloadLink.mockResolvedValue({ url: 'x', expiresAt: 'y' });
        const req = {
            protocol: 'https',
            get: vi.fn().mockReturnValue('api.example.com'),
        };

        await controller.createDownloadLink(5, req as any);

        expect(backupService.createDownloadLink).toHaveBeenCalledWith(5, 'https://api.example.com');
    });

    it('restoreBackup delegates to service', async () => {
        backupService.restoreBackup.mockResolvedValue({ message: 'ok' });

        await controller.restoreBackup(12);

        expect(backupService.restoreBackup).toHaveBeenCalledWith(12);
    });

    it('importBackup parses restoreAfterImport from multipart body', async () => {
        backupService.importBackup.mockResolvedValue({ backupId: 10 });
        const file = {
            originalname: 'backup.tar.gz',
            buffer: Buffer.from('x'),
        };

        await controller.importBackup(file as any, true);
        await controller.importBackup(file as any, 'true');
        await controller.importBackup(file as any, '1');
        await controller.importBackup(file as any, 'false');

        expect(backupService.importBackup).toHaveBeenNthCalledWith(
            1,
            file,
            { restoreAfterImport: true },
        );
        expect(backupService.importBackup).toHaveBeenNthCalledWith(
            2,
            file,
            { restoreAfterImport: true },
        );
        expect(backupService.importBackup).toHaveBeenNthCalledWith(
            3,
            file,
            { restoreAfterImport: true },
        );
        expect(backupService.importBackup).toHaveBeenNthCalledWith(
            4,
            file,
            { restoreAfterImport: false },
        );
    });

    it('downloadBackup sets headers and pipes file stream', async () => {
        const tempRoot = createTempDir('backup-controller-download-');
        const filePath = path.join(tempRoot, 'backup.tar.gz');
        fs.writeFileSync(filePath, Buffer.from('backup-content'));

        backupService.streamBackupFile.mockResolvedValue({
            filePath,
            filename: 'backup.tar.gz',
        });

        const setHeader = vi.fn();
        const res = new PassThrough() as PassThrough & { setHeader: typeof setHeader };
        res.setHeader = setHeader;

        await controller.downloadBackup(9, 'signed', res as any);
        await once(res, 'finish');

        expect(backupService.streamBackupFile).toHaveBeenCalledWith(9, 'signed');
        expect(setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="backup.tar.gz"');
        expect(setHeader).toHaveBeenCalledWith('Content-Type', 'application/gzip');
        expect(setHeader).toHaveBeenCalledWith('Content-Length', Buffer.byteLength('backup-content'));
    });
});
