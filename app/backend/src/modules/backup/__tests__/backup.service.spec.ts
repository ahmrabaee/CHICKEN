import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BackupService } from '../backup.service';

type TestContext = {
    service: BackupService;
    repo: {
        createRun: ReturnType<typeof vi.fn>;
        updateRun: ReturnType<typeof vi.fn>;
        findById: ReturnType<typeof vi.fn>;
        findAll: ReturnType<typeof vi.fn>;
        deleteRun: ReturnType<typeof vi.fn>;
        findRunningBackup: ReturnType<typeof vi.fn>;
        findSuccessfulRunsBefore: ReturnType<typeof vi.fn>;
        failAllRunningBackups: ReturnType<typeof vi.fn>;
    };
    settings: {
        getByKey: ReturnType<typeof vi.fn>;
        set: ReturnType<typeof vi.fn>;
    };
    prisma: {
        $queryRawUnsafe: ReturnType<typeof vi.fn>;
        $connect: ReturnType<typeof vi.fn>;
        $disconnect: ReturnType<typeof vi.fn>;
    };
    tokenService: {
        createToken: ReturnType<typeof vi.fn>;
        verifyToken: ReturnType<typeof vi.fn>;
    };
    settingsStore: Map<string, unknown>;
};

const ORIGINAL_DB_URL = process.env.DATABASE_URL;
const ORIGINAL_BACKUP_SCHEDULE_CRON = process.env.BACKUP_SCHEDULE_CRON;
let tempDirs: string[] = [];

function makeTestContext(options?: {
    backupDir?: string;
    initialSettings?: Record<string, unknown>;
}): TestContext {
    const settingsStore = new Map<string, unknown>(Object.entries(options?.initialSettings ?? {}));
    if (options?.backupDir) {
        settingsStore.set('backup.path_vps', options.backupDir);
    }

    const repo = {
        createRun: vi.fn(),
        updateRun: vi.fn(),
        findById: vi.fn(),
        findAll: vi.fn(),
        deleteRun: vi.fn(),
        findRunningBackup: vi.fn(),
        findSuccessfulRunsBefore: vi.fn(),
        failAllRunningBackups: vi.fn(),
    };

    const settings = {
        getByKey: vi.fn(async (key: string) => {
            if (!settingsStore.has(key)) {
                throw new Error(`Setting '${key}' not found`);
            }
            return {
                key,
                value: settingsStore.get(key),
                dataType: 'string',
            };
        }),
        set: vi.fn(async (key: string, value: unknown) => {
            settingsStore.set(key, value);
            return { key, value };
        }),
    };

    const prisma = {
        $queryRawUnsafe: vi.fn().mockResolvedValue(undefined),
        $connect: vi.fn().mockResolvedValue(undefined),
        $disconnect: vi.fn().mockResolvedValue(undefined),
    };

    const tokenService = {
        createToken: vi.fn().mockReturnValue('signed-token'),
        verifyToken: vi.fn(),
    };

    const service = new BackupService(
        prisma as any,
        settings as any,
        repo as any,
        tokenService as any,
        {} as any,
    );

    return {
        service,
        repo,
        settings,
        prisma,
        tokenService,
        settingsStore,
    };
}

function createTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tempDirs) {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch {
            // ignore cleanup failures
        }
    }
    tempDirs = [];

    if (ORIGINAL_DB_URL === undefined) {
        delete process.env.DATABASE_URL;
    } else {
        process.env.DATABASE_URL = ORIGINAL_DB_URL;
    }

    if (ORIGINAL_BACKUP_SCHEDULE_CRON === undefined) {
        delete process.env.BACKUP_SCHEDULE_CRON;
    } else {
        process.env.BACKUP_SCHEDULE_CRON = ORIGINAL_BACKUP_SCHEDULE_CRON;
    }
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('BackupService', () => {
    it('getConfig returns defaults when settings are absent', async () => {
        const { service } = makeTestContext();

        const config = await service.getConfig();

        expect(config).toMatchObject({
            auto_enabled: true,
            schedule_time: '02:00',
            retention_count: 15,
            scope: 'db+assets',
            path_vps: './data/backups',
            last_success_at: null,
            last_failure_at: null,
            last_error: null,
        });
    });

    it('getConfig merges persisted settings with defaults', async () => {
        const { service } = makeTestContext({
            initialSettings: {
                'backup.auto_enabled': false,
                'backup.retention_count': 30,
            },
        });

        const config = await service.getConfig();

        expect(config.auto_enabled).toBe(false);
        expect(config.retention_count).toBe(30);
        expect(config.schedule_time).toBe('02:00');
    });

    it('updateConfig persists provided keys only', async () => {
        const { service, settings } = makeTestContext();

        await service.updateConfig({ auto_enabled: false, path_vps: './data/custom-backups' });

        expect(settings.set).toHaveBeenCalledWith('backup.auto_enabled', false, undefined, 'boolean');
        expect(settings.set).toHaveBeenCalledWith('backup.path_vps', './data/custom-backups', undefined, 'string');
        expect(settings.set).toHaveBeenCalledTimes(2);
    });

    it('runBackup creates archive and marks run success', async () => {
        const tempRoot = createTempDir('backup-run-success-');
        const backupDir = path.join(tempRoot, 'backups');
        const dbPath = path.join(tempRoot, 'main.db');
        fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(dbPath, Buffer.from('db-content'));
        process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;

        const { service, repo, settings, prisma } = makeTestContext({ backupDir });
        repo.createRun.mockResolvedValue({ id: 101 });
        repo.updateRun.mockResolvedValue(undefined);
        repo.findRunningBackup.mockResolvedValue(null);
        repo.findSuccessfulRunsBefore.mockResolvedValue([]);

        await service.runBackup('manual');

        expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith('PRAGMA wal_checkpoint(TRUNCATE);');
        expect(repo.createRun).toHaveBeenCalledWith({ type: 'manual', status: 'running' });
        expect(repo.updateRun).toHaveBeenCalledWith(
            101,
            expect.objectContaining({
                status: 'success',
                filename: expect.stringMatching(/^backup_manual_\d{8}_\d{6}\.tar\.gz$/),
                sizeBytes: expect.any(Number),
                checksumSha256: expect.any(String),
            }),
        );

        const updatedRunData = repo.updateRun.mock.calls.find(
            ([id, payload]) => id === 101 && payload?.status === 'success',
        )?.[1];
        const filename = updatedRunData?.filename as string;

        expect(filename).toBeTruthy();
        expect(fs.existsSync(path.join(backupDir, filename))).toBe(true);
        expect(settings.set).toHaveBeenCalledWith('backup.last_success_at', expect.any(String));
        expect(repo.findSuccessfulRunsBefore).toHaveBeenCalledTimes(1);
    });

    it('runBackup throws ConflictException when lock is already active', async () => {
        const tempRoot = createTempDir('backup-run-lock-');
        const backupDir = path.join(tempRoot, 'backups');
        fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(path.join(backupDir, '.backup.lock'), String(Date.now()));

        const { service, repo } = makeTestContext({ backupDir });

        await expect(service.runBackup('manual')).rejects.toBeInstanceOf(ConflictException);
        expect(repo.createRun).not.toHaveBeenCalled();
    });

    it('runBackup continues when WAL checkpoint fails', async () => {
        const tempRoot = createTempDir('backup-run-fail-');
        const backupDir = path.join(tempRoot, 'backups');
        const dbPath = path.join(tempRoot, 'main.db');
        fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(dbPath, Buffer.from('db-content'));
        process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;

        const { service, repo, settings, prisma } = makeTestContext({ backupDir });
        repo.createRun.mockResolvedValue({ id: 999 });
        repo.findRunningBackup.mockResolvedValue(null);
        repo.findSuccessfulRunsBefore.mockResolvedValue([]);
        prisma.$queryRawUnsafe.mockRejectedValue(new Error('checkpoint failed'));

        await expect(service.runBackup('manual')).resolves.toBeUndefined();

        expect(repo.updateRun).toHaveBeenCalledWith(
            999,
            expect.objectContaining({
                status: 'success',
                filename: expect.stringMatching(/^backup_manual_\d{8}_\d{6}\.tar\.gz$/),
            }),
        );
        expect(settings.set).toHaveBeenCalledWith('backup.last_success_at', expect.any(String));
        expect(settings.set).toHaveBeenCalledWith('backup.last_error', '');
        expect(settings.set).not.toHaveBeenCalledWith('backup.last_failure_at', expect.any(String));
        expect(fs.existsSync(path.join(backupDir, '.backup.lock'))).toBe(false);
    });

    it('runBackup marks run failed and stores failure metadata on snapshot errors', async () => {
        const tempRoot = createTempDir('backup-run-fail-snapshot-');
        const backupDir = path.join(tempRoot, 'backups');
        const missingDbPath = path.join(tempRoot, 'missing.db');
        fs.mkdirSync(backupDir, { recursive: true });
        process.env.DATABASE_URL = `file:${missingDbPath.replace(/\\/g, '/')}`;

        const { service, repo, settings } = makeTestContext({ backupDir });
        repo.createRun.mockResolvedValue({ id: 1000 });
        repo.findRunningBackup.mockResolvedValue(null);

        await expect(service.runBackup('manual')).rejects.toThrow('Database file not found at');

        expect(repo.updateRun).toHaveBeenCalledWith(
            1000,
            expect.objectContaining({
                status: 'failed',
                errorMessage: expect.stringContaining('Database file not found at'),
            }),
        );
        expect(settings.set).toHaveBeenCalledWith('backup.last_failure_at', expect.any(String));
        expect(settings.set).toHaveBeenCalledWith(
            'backup.last_error',
            expect.stringContaining('Database file not found at'),
        );
        expect(fs.existsSync(path.join(backupDir, '.backup.lock'))).toBe(false);
    });

    it('getStatus reconciles stale running runs when lock is not active', async () => {
        const tempRoot = createTempDir('backup-status-stale-');
        const backupDir = path.join(tempRoot, 'backups');
        fs.mkdirSync(backupDir, { recursive: true });

        const { service, repo } = makeTestContext({
            backupDir,
            initialSettings: { 'backup.auto_enabled': true },
        });
        repo.findRunningBackup.mockResolvedValue({ id: 1, status: 'running' });
        repo.failAllRunningBackups.mockResolvedValue({ count: 1 });

        const status = await service.getStatus();

        expect(repo.failAllRunningBackups).toHaveBeenCalledWith(
            'Recovered stale running backup after an unexpected interruption',
        );
        expect(status.running).toBe(false);
        expect(status.auto_enabled).toBe(true);
        expect(status.next_run_at).toEqual(expect.any(String));
    });

    it('getStatus computes next_run_at from BACKUP_SCHEDULE_CRON when provided', async () => {
        process.env.BACKUP_SCHEDULE_CRON = '* * * * *';

        const tempRoot = createTempDir('backup-status-cron-env-');
        const backupDir = path.join(tempRoot, 'backups');
        fs.mkdirSync(backupDir, { recursive: true });

        const { service, repo } = makeTestContext({
            backupDir,
            initialSettings: {
                'backup.auto_enabled': true,
                'backup.schedule_time': '23:59',
            },
        });
        repo.findRunningBackup.mockResolvedValue(null);

        const before = Date.now();
        const status = await service.getStatus();
        const after = Date.now();

        expect(status.next_run_at).toBeTruthy();
        const nextRunMs = new Date(status.next_run_at as string).getTime();
        expect(nextRunMs).toBeGreaterThan(before);
        expect(nextRunMs - after).toBeLessThanOrEqual(60_000);
    });

    it('getStatus falls back to 02:00 when BACKUP_SCHEDULE_CRON is missing even if old schedule_time exists', async () => {
        delete process.env.BACKUP_SCHEDULE_CRON;

        const tempRoot = createTempDir('backup-status-default-2am-');
        const backupDir = path.join(tempRoot, 'backups');
        fs.mkdirSync(backupDir, { recursive: true });

        const { service, repo } = makeTestContext({
            backupDir,
            initialSettings: {
                'backup.auto_enabled': true,
                'backup.schedule_time': '23:06',
            },
        });
        repo.findRunningBackup.mockResolvedValue(null);

        const status = await service.getStatus();

        expect(status.next_run_at).toBeTruthy();
        const nextRun = new Date(status.next_run_at as string);
        expect(nextRun.getHours()).toBe(2);
        expect(nextRun.getMinutes()).toBe(0);
    });

    it('applyRetention deletes files and DB rows older than cutoff', async () => {
        const tempRoot = createTempDir('backup-retention-');
        const backupDir = path.join(tempRoot, 'backups');
        fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(path.join(backupDir, 'old-1.tar.gz'), Buffer.from('1'));
        fs.writeFileSync(path.join(backupDir, 'old-2.tar.gz'), Buffer.from('2'));

        const { service, repo } = makeTestContext({
            initialSettings: { 'backup.retention_count': 15 },
        });
        repo.findSuccessfulRunsBefore.mockResolvedValue([
            { id: 10, filename: 'old-1.tar.gz' },
            { id: 11, filename: 'old-2.tar.gz' },
        ]);

        await service.applyRetention(backupDir);

        expect(repo.findSuccessfulRunsBefore).toHaveBeenCalledWith(expect.any(Date));
        expect(repo.deleteRun).toHaveBeenNthCalledWith(1, 10);
        expect(repo.deleteRun).toHaveBeenNthCalledWith(2, 11);
        expect(fs.existsSync(path.join(backupDir, 'old-1.tar.gz'))).toBe(false);
        expect(fs.existsSync(path.join(backupDir, 'old-2.tar.gz'))).toBe(false);
    });

    it('applyRetention falls back to default retention days when setting is invalid', async () => {
        const tempRoot = createTempDir('backup-retention-default-');
        const backupDir = path.join(tempRoot, 'backups');
        fs.mkdirSync(backupDir, { recursive: true });

        const { service, repo } = makeTestContext({
            initialSettings: { 'backup.retention_count': 'invalid' },
        });
        repo.findSuccessfulRunsBefore.mockResolvedValue([]);

        const before = Date.now();
        await service.applyRetention(backupDir);
        const after = Date.now();

        const cutoff = repo.findSuccessfulRunsBefore.mock.calls[0][0] as Date;
        const diffDaysFromBefore = (before - cutoff.getTime()) / (24 * 60 * 60 * 1000);
        const diffDaysFromAfter = (after - cutoff.getTime()) / (24 * 60 * 60 * 1000);

        expect(diffDaysFromBefore).toBeGreaterThan(14.9);
        expect(diffDaysFromAfter).toBeLessThan(15.1);
    });

    it('createDownloadLink signs and returns expiring URL', async () => {
        const { service, repo, tokenService } = makeTestContext();
        repo.findById.mockResolvedValue({ id: 7, filename: 'backup.tar.gz' });
        tokenService.createToken.mockReturnValue('abc-token');

        const link = await service.createDownloadLink(7, 'http://localhost:3000');

        expect(tokenService.createToken).toHaveBeenCalledWith(7);
        expect(link.url).toBe('http://localhost:3000/v1/system/backups/7/download?token=abc-token');
        expect(link.expiresAt).toEqual(expect.any(String));
    });

    it('streamBackupFile validates token and resolves on-disk file', async () => {
        const tempRoot = createTempDir('backup-stream-');
        const backupDir = path.join(tempRoot, 'backups');
        fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(path.join(backupDir, 'backup.tar.gz'), Buffer.from('archive'));

        const { service, repo, tokenService } = makeTestContext({ backupDir });
        repo.findById.mockResolvedValue({ id: 1, filename: 'backup.tar.gz' });

        const result = await service.streamBackupFile(1, 'signed');

        expect(tokenService.verifyToken).toHaveBeenCalledWith('signed', 1);
        expect(result.filename).toBe('backup.tar.gz');
        expect(result.filePath).toBe(path.join(backupDir, 'backup.tar.gz'));
    });

    it('streamBackupFile throws NotFound when run or file is missing', async () => {
        const tempRoot = createTempDir('backup-stream-missing-');
        const backupDir = path.join(tempRoot, 'backups');
        fs.mkdirSync(backupDir, { recursive: true });

        const { service, repo } = makeTestContext({ backupDir });
        repo.findById.mockResolvedValue(null);
        await expect(service.streamBackupFile(2, 'signed')).rejects.toBeInstanceOf(NotFoundException);

        repo.findById.mockResolvedValue({ id: 2, filename: 'missing.tar.gz' });
        await expect(service.streamBackupFile(2, 'signed')).rejects.toBeInstanceOf(NotFoundException);
    });
});
