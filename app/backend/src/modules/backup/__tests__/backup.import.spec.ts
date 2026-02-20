import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tar from 'tar';
import { BadRequestException } from '@nestjs/common';
import { BackupService } from '../backup.service';

function makeService(backupDir: string) {
    const repo = {
        createRun: vi.fn().mockResolvedValue({ id: 123 }),
        updateRun: vi.fn().mockResolvedValue({}),
        findRunningBackup: vi.fn(),
        failAllRunningBackups: vi.fn(),
        findSuccessfulRunsBefore: vi.fn().mockResolvedValue([]),
        deleteRun: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
    };

    const settings = {
        getByKey: vi.fn().mockResolvedValue({ value: backupDir }),
        set: vi.fn(),
    };

    const service = new BackupService(
        {} as any,
        settings as any,
        repo as any,
        {} as any,
        {} as any,
    );

    return { service, repo };
}

async function createValidBackupArchiveBuffer(tempRoot: string): Promise<Buffer> {
    const sourceDir = path.join(tempRoot, 'source');
    fs.mkdirSync(path.join(sourceDir, 'db'), { recursive: true });
    // Minimal SQLite signature; enough for service-level validation.
    fs.writeFileSync(path.join(sourceDir, 'db', 'app.db'), Buffer.from('SQLite format 3\0'));

    const archivePath = path.join(tempRoot, 'valid-backup.tar.gz');
    await tar.c(
        {
            gzip: true,
            cwd: sourceDir,
            file: archivePath,
        },
        ['db/app.db'],
    );

    return fs.readFileSync(archivePath);
}

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

describe('BackupService importBackup', () => {
    it('imports a valid archive and marks run as success', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-import-success-'));
        tempDirs.push(tempRoot);
        const backupDir = path.join(tempRoot, 'backups');
        fs.mkdirSync(backupDir, { recursive: true });

        const { service, repo } = makeService(backupDir);
        const buffer = await createValidBackupArchiveBuffer(tempRoot);

        const result = await service.importBackup({
            originalname: 'backup.tar.gz',
            buffer,
        });

        expect(repo.createRun).toHaveBeenCalledWith({ type: 'manual', status: 'running' });
        expect(repo.updateRun).toHaveBeenCalledWith(
            123,
            expect.objectContaining({
                status: 'success',
                filename: expect.stringMatching(/^backup_manual_import_\d+\.tar\.gz$/),
                sizeBytes: expect.any(Number),
                checksumSha256: expect.any(String),
            }),
        );
        expect(result).toEqual(
            expect.objectContaining({
                backupId: 123,
                filename: expect.stringMatching(/^backup_manual_import_\d+\.tar\.gz$/),
            }),
        );

        const importedArchives = fs
            .readdirSync(backupDir)
            .filter((name) => name.endsWith('.tar.gz'));
        expect(importedArchives).toHaveLength(1);
        expect(importedArchives[0]).toBe(result.filename);
    });

    it('fails invalid archives with BadRequest and marks run as failed', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-import-fail-'));
        tempDirs.push(tempRoot);
        const backupDir = path.join(tempRoot, 'backups');
        fs.mkdirSync(backupDir, { recursive: true });

        const { service, repo } = makeService(backupDir);

        await expect(
            service.importBackup({
                originalname: 'corrupt.tar.gz',
                buffer: Buffer.from('not-a-tar-archive'),
            }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(repo.createRun).toHaveBeenCalledWith({ type: 'manual', status: 'running' });
        expect(repo.updateRun).toHaveBeenCalledWith(
            123,
            expect.objectContaining({
                status: 'failed',
                errorMessage: expect.any(String),
            }),
        );

        const importedArchives = fs
            .readdirSync(backupDir)
            .filter((name) => name.endsWith('.tar.gz'));
        expect(importedArchives).toHaveLength(0);
    });

    it('can restore immediately after import when requested', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-import-restore-'));
        tempDirs.push(tempRoot);
        const backupDir = path.join(tempRoot, 'backups');
        fs.mkdirSync(backupDir, { recursive: true });

        const { service } = makeService(backupDir);
        const buffer = await createValidBackupArchiveBuffer(tempRoot);
        const restoreSpy = vi
            .spyOn(service, 'restoreBackup')
            .mockResolvedValue({ message: 'ok', messageAr: 'ok', restoredFrom: 'x' });

        const result = await service.importBackup(
            {
                originalname: 'backup.tar.gz',
                buffer,
            },
            { restoreAfterImport: true },
        );

        expect(restoreSpy).toHaveBeenCalledWith(123);
        expect(result).toEqual(
            expect.objectContaining({
                backupId: 123,
                restored: true,
            }),
        );
    });
});
