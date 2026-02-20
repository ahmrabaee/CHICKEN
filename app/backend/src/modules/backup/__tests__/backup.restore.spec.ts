import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { BackupService } from '../backup.service';

let tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs) {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch {
            // ignore cleanup errors
        }
    }
    tempDirs = [];
});

describe('BackupService restoreBackup', () => {
    it('returns BadRequest for corrupted archive and records failure status', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-restore-fail-'));
        tempDirs.push(tempRoot);
        const backupDir = path.join(tempRoot, 'backups');
        fs.mkdirSync(backupDir, { recursive: true });

        const corruptedFilename = 'backup_manual_corrupt.tar.gz';
        fs.writeFileSync(path.join(backupDir, corruptedFilename), Buffer.from('not-a-valid-archive'));

        const repo = {
            findById: vi.fn().mockResolvedValue({ id: 1, filename: corruptedFilename }),
            findRunningBackup: vi.fn().mockResolvedValue(null),
            failAllRunningBackups: vi.fn().mockResolvedValue({ count: 0 }),
            updateRun: vi.fn(),
            createRun: vi.fn(),
            findSuccessfulRunsBefore: vi.fn().mockResolvedValue([]),
            deleteRun: vi.fn(),
            findAll: vi.fn(),
        };

        const settings = {
            getByKey: vi.fn().mockResolvedValue({ value: backupDir }),
            set: vi.fn().mockResolvedValue(undefined),
        };

        const prisma = {
            $queryRawUnsafe: vi.fn(),
            $disconnect: vi.fn(),
            $connect: vi.fn(),
        };

        const service = new BackupService(
            prisma as any,
            settings as any,
            repo as any,
            {} as any,
            {} as any,
        );

        await expect(service.restoreBackup(1)).rejects.toBeInstanceOf(BadRequestException);

        expect(settings.set).toHaveBeenCalledWith('backup.last_failure_at', expect.any(String));
        expect(settings.set).toHaveBeenCalledWith('backup.last_error', expect.any(String));
    });
});
