import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BackupService } from '../backup.service';
import { BackupScheduler } from '../backup.scheduler';

const ORIGINAL_DB_URL = process.env.DATABASE_URL;

let tempDirs: string[] = [];

function createTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
}

function createContext(options: {
    backupDir: string;
    initialSettings?: Record<string, unknown>;
}) {
    const settingsStore = new Map<string, unknown>(Object.entries(options.initialSettings ?? {}));
    settingsStore.set('backup.path_vps', options.backupDir);

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
            return { key, value: settingsStore.get(key), dataType: 'string' };
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
        createToken: vi.fn().mockReturnValue('token'),
        verifyToken: vi.fn(),
    };

    const backupService = new BackupService(
        prisma as any,
        settings as any,
        repo as any,
        tokenService as any,
        {} as any,
    );
    const scheduler = new BackupScheduler(backupService, settings as any);

    return { backupService, scheduler, repo, settings, prisma };
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    for (const dir of tempDirs) {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch {
            // ignore cleanup failure
        }
    }
    tempDirs = [];

    if (ORIGINAL_DB_URL === undefined) {
        delete process.env.DATABASE_URL;
    } else {
        process.env.DATABASE_URL = ORIGINAL_DB_URL;
    }
});

describe('Backup auto flow', () => {
    it('creates an auto backup archive when scheduler triggers and auto backup is enabled', async () => {
        const tempRoot = createTempDir('backup-auto-enabled-');
        const backupDir = path.join(tempRoot, 'backups');
        const dbPath = path.join(tempRoot, 'app.db');
        fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(dbPath, Buffer.from('main-db-content'));
        process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;

        const { scheduler, repo } = createContext({
            backupDir,
            initialSettings: {
                'backup.auto_enabled': true,
            },
        });

        repo.createRun.mockResolvedValue({ id: 1 });
        repo.findRunningBackup.mockResolvedValue(null);
        repo.findSuccessfulRunsBefore.mockResolvedValue([]);

        await scheduler.handleAutoBackup();

        expect(repo.createRun).toHaveBeenCalledWith({ type: 'auto', status: 'running' });
        expect(repo.updateRun).toHaveBeenCalledWith(
            1,
            expect.objectContaining({
                status: 'success',
                filename: expect.stringMatching(/^backup_auto_\d{8}_\d{6}\.tar\.gz$/),
            }),
        );

        const successUpdate = repo.updateRun.mock.calls.find(
            ([id, payload]) => id === 1 && payload?.status === 'success',
        )?.[1];
        const filename = successUpdate?.filename as string;
        expect(filename).toBeTruthy();
        expect(fs.existsSync(path.join(backupDir, filename))).toBe(true);
    });

    it('does not create backup when auto backup is disabled', async () => {
        const tempRoot = createTempDir('backup-auto-disabled-');
        const backupDir = path.join(tempRoot, 'backups');
        const dbPath = path.join(tempRoot, 'app.db');
        fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(dbPath, Buffer.from('main-db-content'));
        process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;

        const { scheduler, repo } = createContext({
            backupDir,
            initialSettings: {
                'backup.auto_enabled': false,
            },
        });

        await scheduler.handleAutoBackup();

        expect(repo.createRun).not.toHaveBeenCalled();
        const files = fs.readdirSync(backupDir).filter((fileName) => fileName.endsWith('.tar.gz'));
        expect(files).toHaveLength(0);
    });

    it('defaults to enabled when auto setting is missing (works without desktop/client dependency)', async () => {
        const tempRoot = createTempDir('backup-auto-default-enabled-');
        const backupDir = path.join(tempRoot, 'backups');
        const dbPath = path.join(tempRoot, 'app.db');
        fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(dbPath, Buffer.from('main-db-content'));
        process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;

        const { scheduler, repo, settings } = createContext({ backupDir });
        repo.createRun.mockResolvedValue({ id: 2 });
        repo.findRunningBackup.mockResolvedValue(null);
        repo.findSuccessfulRunsBefore.mockResolvedValue([]);

        await scheduler.handleAutoBackup();

        expect(settings.getByKey).toHaveBeenCalledWith('backup.auto_enabled');
        expect(repo.createRun).toHaveBeenCalledWith({ type: 'auto', status: 'running' });
    });

    it('handles concurrent scheduler triggers safely (many connected devices pressure)', async () => {
        const tempRoot = createTempDir('backup-auto-concurrent-');
        const backupDir = path.join(tempRoot, 'backups');
        const dbPath = path.join(tempRoot, 'app.db');
        fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(dbPath, Buffer.from('main-db-content'));
        process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;

        const { scheduler, repo } = createContext({
            backupDir,
            initialSettings: {
                'backup.auto_enabled': true,
            },
        });

        repo.createRun.mockResolvedValue({ id: 3 });
        repo.findRunningBackup.mockResolvedValue(null);
        repo.findSuccessfulRunsBefore.mockResolvedValue([]);

        await Promise.all([scheduler.handleAutoBackup(), scheduler.handleAutoBackup()]);

        // One run should proceed; the other should be rejected by lock and swallowed by scheduler.
        expect(repo.createRun).toHaveBeenCalledTimes(1);
        expect(repo.updateRun).toHaveBeenCalledWith(
            3,
            expect.objectContaining({ status: 'success' }),
        );
    });
});
