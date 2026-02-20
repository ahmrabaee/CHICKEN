import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import { BackupRepository } from './backup.repository';
import { BackupTokenService } from './security/backup-token.service';
import { UpdateBackupConfigDto } from './dto/backup-config.dto';
import { BackupListQueryDto } from './dto/backup-list.query.dto';
import {
    resolveBackupDir,
    resolveStagingDir,
    resolveLockFile,
    resolveDbPath,
    resolveBackendPath,
    ensureDir,
    generateBackupFilename,
} from './utils/paths';
import { acquireLock, isLocked, releaseLock } from './utils/file-lock';
import { createSqliteSnapshot } from './utils/sqlite-snapshot';
import { createArchive, extractArchive } from './utils/archive';
import { computeFileSha256 } from './utils/checksum';
import {
    computeNextRunAt,
    resolveAutoBackupCronExpression,
} from './utils/auto-backup-schedule';

const RETENTION_DAYS = 15;
const STALE_RUNNING_MESSAGE = 'Recovered stale running backup after an unexpected interruption';

// Asset directories to include in backup (relative to cwd)
const ASSET_DIRS = [
    { src: './data/uploads', archiveName: 'assets/uploads' },
    { src: './data/assets', archiveName: 'assets/assets' },
    { src: './public/logos', archiveName: 'assets/logos' },
];

@Injectable()
export class BackupService {
    private readonly logger = new Logger(BackupService.name);

    constructor(
        private prisma: PrismaService,
        private settings: SettingsService,
        private repo: BackupRepository,
        private tokenService: BackupTokenService,
        private config: ConfigService,
    ) { }

    private async resolveBackupDirectory(): Promise<string> {
        let pathVps = './data/backups';
        try {
            const setting = await this.settings.getByKey('backup.path_vps');
            pathVps = String(setting.value);
        } catch {
            // Use default backup directory
        }
        return resolveBackupDir(pathVps);
    }

    private async reconnectPrismaWithRetry(maxAttempts = 5, delayMs = 150): Promise<void> {
        let lastError: unknown;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await this.prisma.$connect();
                return;
            } catch (error) {
                lastError = error;
                if (attempt < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }
            }
        }
        throw lastError instanceof Error ? lastError : new Error('Failed to reconnect Prisma');
    }

    private async reconcileStaleRunningRuns(lockFile: string): Promise<void> {
        if (isLocked(lockFile)) return;

        try {
            const running = await this.repo.findRunningBackup();
            if (!running) return;

            const updated = await this.repo.failAllRunningBackups(STALE_RUNNING_MESSAGE);
            if (updated.count > 0) {
                this.logger.warn(`Recovered ${updated.count} stale running backup record(s)`);
            }
        } catch {
            this.logger.warn('Could not reconcile stale running backup records');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Config
    // ─────────────────────────────────────────────────────────────────────────────

    async getConfig() {
        const keys = [
            'backup.auto_enabled',
            'backup.schedule_time',
            'backup.retention_count',
            'backup.scope',
            'backup.path_vps',
            'backup.last_success_at',
            'backup.last_failure_at',
            'backup.last_error',
        ];

        const result: Record<string, any> = {
            auto_enabled: true,
            schedule_time: '02:00',
            retention_count: RETENTION_DAYS,
            scope: 'db+assets',
            path_vps: './data/backups',
            last_success_at: null,
            last_failure_at: null,
            last_error: null,
        };

        await Promise.all(
            keys.map(async (key) => {
                try {
                    const setting = await this.settings.getByKey(key);
                    const shortKey = key.replace('backup.', '');
                    result[shortKey] = setting.value;
                } catch {
                    // Key not set yet � use default
                }
            }),
        );

        return result;
    }

    async updateConfig(dto: UpdateBackupConfigDto) {
        const updates: { key: string; value: any }[] = [];

        if (dto.auto_enabled !== undefined) {
            updates.push({ key: 'backup.auto_enabled', value: dto.auto_enabled });
        }
        if (dto.path_vps !== undefined) {
            updates.push({ key: 'backup.path_vps', value: dto.path_vps });
        }

        await Promise.all(
            updates.map((u) =>
                this.settings.set(u.key, u.value, undefined, typeof u.value === 'boolean' ? 'boolean' : 'string'),
            ),
        );

        return this.getConfig();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Status
    // ─────────────────────────────────────────────────────────────────────────────

    async getStatus() {
        const backupDir = await this.resolveBackupDirectory();
        const lockFile = resolveLockFile(backupDir);
        const lockActive = isLocked(lockFile);

        let config: Record<string, any>;
        try {
            config = await this.getConfig();
        } catch (error) {
            this.logger.warn('Could not read backup config while computing status');
            try {
                await this.reconnectPrismaWithRetry(2, 100);
            } catch {
                // best-effort reconnect
            }
            config = {
                auto_enabled: false,
                last_success_at: null,
                last_failure_at: null,
                last_error: null,
            };
        }

        let running = lockActive;
        try {
            const runningRun = await this.repo.findRunningBackup();
            if (runningRun && !lockActive) {
                await this.repo.failAllRunningBackups(STALE_RUNNING_MESSAGE);
            } else {
                running = lockActive || !!runningRun;
            }
        } catch (error) {
            this.logger.warn('Could not read running backup state');
            try {
                await this.reconnectPrismaWithRetry(2, 100);
            } catch {
                // best-effort reconnect
            }
        }

        const autoEnabled = config.auto_enabled === true || config.auto_enabled === 'true';

        let nextRunAt: string | null = null;
        if (autoEnabled) {
            const cronExpression = resolveAutoBackupCronExpression({
                envCron: process.env.BACKUP_SCHEDULE_CRON,
            });
            nextRunAt = computeNextRunAt(cronExpression);
        }

        return {
            running,
            last_success_at: config.last_success_at,
            last_failure_at: config.last_failure_at,
            last_error: config.last_error,
            next_run_at: nextRunAt,
            auto_enabled: autoEnabled,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // List
    // ─────────────────────────────────────────────────────────────────────────────

    async listRuns(query: BackupListQueryDto) {
        return this.repo.findAll(query);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Run Backup
    // ─────────────────────────────────────────────────────────────────────────────

    async runBackup(type: 'auto' | 'manual'): Promise<void> {
        const backupDir = await this.resolveBackupDirectory();
        const stagingDir = resolveStagingDir(backupDir);
        const lockFile = resolveLockFile(backupDir);

        ensureDir(backupDir);
        ensureDir(stagingDir);
        await this.reconcileStaleRunningRuns(lockFile);

        // Acquire lock
        if (!acquireLock(lockFile)) {
            throw new ConflictException({
                code: 'BACKUP_IN_PROGRESS',
                message: 'A backup is already running',
                messageAr: 'النسخ الاحتياطي قيد التشغيل بالفعل',
            });
        }

        let runId: number | null = null;

        try {
            // Create DB record with status=running
            const run = await this.repo.createRun({ type, status: 'running' });
            runId = run.id;

            // 1. WAL checkpoint (best-effort; do not fail backup when checkpoint is busy/unavailable)
            // Note: Use $queryRawUnsafe because PRAGMA wal_checkpoint returns a result set,
            // which causes $executeRawUnsafe to throw an error in SQLite.
            try {
                await this.prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
            } catch (checkpointError) {
                const message = checkpointError instanceof Error ? checkpointError.message : String(checkpointError);
                this.logger.warn(`WAL checkpoint failed before backup; continuing with snapshot: ${message}`);
            }

            // 2. SQLite snapshot
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const snapshotPath = await createSqliteSnapshot(stagingDir, timestamp);

            // 3. Build archive entries
            const entries = [
                { sourcePath: snapshotPath, archiveName: 'db/app.db' },
            ];

            for (const asset of ASSET_DIRS) {
                const absPath = resolveBackendPath(asset.src);
                if (fs.existsSync(absPath)) {
                    entries.push({ sourcePath: absPath, archiveName: asset.archiveName });
                }
            }

            // 4. Create archive
            const filename = generateBackupFilename(type);
            const archivePath = path.join(backupDir, filename);
            await createArchive(archivePath, entries);

            // 5. Cleanup snapshot
            try { fs.unlinkSync(snapshotPath); } catch { /* ignore */ }

            // 6. Compute checksum + stat in parallel
            const [checksum, stat] = await Promise.all([
                computeFileSha256(archivePath),
                fs.promises.stat(archivePath),
            ]);

            // 7. Update DB record
            await this.repo.updateRun(runId, {
                status: 'success',
                finishedAt: new Date(),
                filename,
                sizeBytes: stat.size,
                checksumSha256: checksum,
            });

            // 8. Update system settings
            try {
                const completedAt = new Date().toISOString();
                await Promise.all([
                    this.settings.set('backup.last_success_at', completedAt),
                    this.settings.set('backup.last_error', ''),
                ]);
            } catch {
                this.logger.warn('Failed to persist backup success status');
            }

            this.logger.log(`Backup completed: ${filename} (${stat.size} bytes)`);

            // 9. Delete successful backups older than retention window.
            await this.applyRetention(backupDir);
        } catch (err: any) {
            const errorMessage = err?.message ?? 'Unknown error';
            this.logger.error(`Backup failed: ${errorMessage}`);

            if (runId !== null) {
                try {
                    await this.repo.updateRun(runId, {
                        status: 'failed',
                        finishedAt: new Date(),
                        errorMessage,
                    });
                } catch {
                    this.logger.warn('Failed to update backup run failure state');
                }
            }
            try {
                const failedAt = new Date().toISOString();
                await Promise.all([
                    this.settings.set('backup.last_failure_at', failedAt),
                    this.settings.set('backup.last_error', errorMessage),
                ]);
            } catch {
                this.logger.warn('Failed to persist backup failure status');
            }

            throw err;
        } finally {
            releaseLock(lockFile);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Retention
    // ─────────────────────────────────────────────────────────────────────────────

    async importBackup(
        file?: { originalname?: string; buffer?: Buffer; size?: number; path?: string },
        options?: { restoreAfterImport?: boolean },
    ) {
        let inputBuffer = file?.buffer;
        if ((!inputBuffer || inputBuffer.length === 0) && file?.path) {
            try {
                inputBuffer = await fs.promises.readFile(file.path);
            } catch {
                inputBuffer = undefined;
            }
        }

        if (!inputBuffer || inputBuffer.length === 0) {
            throw new BadRequestException({
                code: 'BACKUP_FILE_REQUIRED',
                message: 'Backup file is required',
                messageAr: 'Backup file is required',
            });
        }

        const backupDir = await this.resolveBackupDirectory();
        ensureDir(backupDir);

        const run = await this.repo.createRun({ type: 'manual', status: 'running' });
        const originalName = file?.originalname ?? 'backup-import.tar.gz';
        const importedFilename = `backup_manual_import_${Date.now()}.tar.gz`;
        const importedFilePath = path.join(backupDir, importedFilename);
        const validationDir = path.join(resolveStagingDir(backupDir), `.import-validate-${Date.now()}`);

        try {
            if (!/\.tar\.gz$/i.test(originalName) && !/\.tgz$/i.test(originalName)) {
                throw new BadRequestException({
                    code: 'BACKUP_FILE_INVALID',
                    message: 'Backup file must be .tar.gz or .tgz',
                    messageAr: 'Backup file must be .tar.gz or .tgz',
                });
            }

            await fs.promises.writeFile(importedFilePath, inputBuffer);

            // Validate that imported archive is usable by restore flow.
            ensureDir(validationDir);
            try {
                await extractArchive(importedFilePath, validationDir);
            } catch {
                throw new BadRequestException({
                    code: 'BACKUP_FILE_INVALID',
                    message: 'Backup archive is corrupted or unreadable',
                    messageAr: 'Backup archive is corrupted or unreadable',
                });
            }
            const extractedDbPath = path.join(validationDir, 'db', 'app.db');
            if (!fs.existsSync(extractedDbPath) || !isLikelySqliteFile(extractedDbPath)) {
                throw new BadRequestException({
                    code: 'BACKUP_FILE_INVALID',
                    message: 'Archive must contain a valid db/app.db file',
                    messageAr: 'Archive must contain a valid db/app.db file',
                });
            }

            const checksum = await computeFileSha256(importedFilePath);
            const stat = await fs.promises.stat(importedFilePath);

            await this.repo.updateRun(run.id, {
                status: 'success',
                finishedAt: new Date(),
                filename: importedFilename,
                sizeBytes: stat.size,
                checksumSha256: checksum,
            });

            await this.applyRetention(backupDir);

            let restoreResult:
                | {
                    message: string;
                    messageAr: string;
                    restoredFrom: string;
                }
                | undefined;

            if (options?.restoreAfterImport) {
                restoreResult = await this.restoreBackup(run.id) as {
                    message: string;
                    messageAr: string;
                    restoredFrom: string;
                };
            }

            return {
                message: restoreResult ? 'Backup imported and restored successfully' : 'Backup imported successfully',
                messageAr: restoreResult ? 'Backup imported and restored successfully' : 'Backup imported successfully',
                backupId: run.id,
                filename: importedFilename,
                restored: !!restoreResult,
                restoreMessage: restoreResult?.message,
                restoreMessageAr: restoreResult?.messageAr,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to import backup';
            try {
                await this.repo.updateRun(run.id, {
                    status: 'failed',
                    finishedAt: new Date(),
                    errorMessage,
                });
            } catch {
                this.logger.warn('Failed to update import backup run failure state');
            }

            try {
                if (fs.existsSync(importedFilePath)) {
                    fs.unlinkSync(importedFilePath);
                }
            } catch {
                // ignore cleanup failure
            }
            throw error;
        } finally {
            try {
                removePathRecursive(validationDir);
            } catch {
                // ignore cleanup failure
            }
        }
    }

    async restoreBackup(id: number) {
        const run = await this.repo.findById(id);
        if (!run || !run.filename) {
            throw new NotFoundException({
                code: 'BACKUP_NOT_FOUND',
                message: `Backup #${id} not found`,
                messageAr: `Backup #${id} not found`,
            });
        }

        const backupDir = await this.resolveBackupDirectory();
        const archivePath = path.join(backupDir, run.filename);
        if (!fs.existsSync(archivePath)) {
            throw new NotFoundException({
                code: 'BACKUP_NOT_FOUND',
                message: 'Backup file not found on disk',
                messageAr: 'Backup file not found on disk',
            });
        }

        const lockFile = resolveLockFile(backupDir);
        await this.reconcileStaleRunningRuns(lockFile);
        if (!acquireLock(lockFile)) {
            throw new ConflictException({
                code: 'BACKUP_IN_PROGRESS',
                message: 'A backup or restore operation is already running',
                messageAr: 'A backup or restore operation is already running',
            });
        }

        const restoreDir = path.join(resolveStagingDir(backupDir), `.restore-${Date.now()}`);
        const dbPath = resolveDbPath();
        const dbBackupPath = `${dbPath}.before-restore-${Date.now()}.bak`;
        let prismaDisconnected = false;

        try {
            ensureDir(restoreDir);
            try {
                await extractArchive(archivePath, restoreDir);
            } catch {
                throw new BadRequestException({
                    code: 'BACKUP_FILE_INVALID',
                    message: 'Backup archive is corrupted or unreadable',
                    messageAr: 'Backup archive is corrupted or unreadable',
                });
            }

            const extractedDbPath = path.join(restoreDir, 'db', 'app.db');
            if (!fs.existsSync(extractedDbPath)) {
                throw new BadRequestException({
                    code: 'BACKUP_FILE_INVALID',
                    message: 'Archive does not contain db/app.db',
                    messageAr: 'Archive does not contain db/app.db',
                });
            }
            if (!isLikelySqliteFile(extractedDbPath)) {
                throw new BadRequestException({
                    code: 'BACKUP_FILE_INVALID',
                    message: 'Archive database file is invalid',
                    messageAr: 'Archive database file is invalid',
                });
            }

            try {
                await this.prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
            } catch {
                // Ignore checkpoint failure
            }

            for (const asset of ASSET_DIRS) {
                const extractedAssetPath = path.join(restoreDir, asset.archiveName);
                if (!fs.existsSync(extractedAssetPath)) continue;

                const destinationPath = resolveBackendPath(asset.src);
                removePathRecursive(destinationPath);
                copyPathRecursive(extractedAssetPath, destinationPath);
            }

            ensureDir(path.dirname(dbPath));
            if (fs.existsSync(dbPath)) {
                await fs.promises.copyFile(dbPath, dbBackupPath);
            }

            // Keep Prisma offline only for the DB file swap window.
            await this.prisma.$disconnect();
            prismaDisconnected = true;
            try {
                await fs.promises.copyFile(extractedDbPath, dbPath);
            } finally {
                await this.reconnectPrismaWithRetry();
                prismaDisconnected = false;
            }

            await this.settings.set('backup.last_success_at', new Date().toISOString());
            await this.settings.set('backup.last_error', '');

            this.logger.log(`Backup restored from ${run.filename}`);
            return {
                message: 'Backup restored successfully',
                messageAr: 'Backup restored successfully',
                restoredFrom: run.filename,
            };
        } catch (error) {
            try {
                if (prismaDisconnected) {
                    await this.reconnectPrismaWithRetry();
                    prismaDisconnected = false;
                }
            } catch {
                // best-effort reconnect
            }

            const errorMessage = error instanceof Error ? error.message : 'Failed to restore backup';
            try {
                await this.settings.set('backup.last_failure_at', new Date().toISOString());
                await this.settings.set('backup.last_error', errorMessage);
            } catch {
                this.logger.warn('Failed to persist restore failure status');
            }
            throw error;
        } finally {
            if (prismaDisconnected) {
                try {
                    await this.reconnectPrismaWithRetry();
                } catch {
                    this.logger.error('Failed to reconnect Prisma after restore');
                }
            }
            try {
                removePathRecursive(restoreDir);
            } catch {
                // Ignore cleanup failures
            }
            releaseLock(lockFile);
        }
    }

    async applyRetention(backupDir: string): Promise<void> {
        let retentionDays = RETENTION_DAYS;
        try {
            const setting = await this.settings.getByKey('backup.retention_count');
            const parsed = Number(setting.value);
            if (Number.isFinite(parsed) && parsed >= 1) {
                retentionDays = Math.floor(parsed);
            }
        } catch {
            // Use default retention days
        }

        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        const toDelete = await this.repo.findSuccessfulRunsBefore(cutoffDate);
        if (toDelete.length === 0) return;

        for (const run of toDelete) {
            // Delete file from disk
            if (run.filename) {
                const filePath = path.join(backupDir, run.filename);
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (e) {
                    this.logger.warn(`Could not delete backup file ${filePath}: ${e}`);
                }
            }
            // Delete DB row
            await this.repo.deleteRun(run.id);
        }

        this.logger.log(`Retention: deleted ${toDelete.length} backups older than ${retentionDays} day(s)`);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Download
    // ─────────────────────────────────────────────────────────────────────────────

    async createDownloadLink(id: number, baseUrl: string) {
        const run = await this.repo.findById(id);
        if (!run) {
            throw new NotFoundException({
                code: 'BACKUP_NOT_FOUND',
                message: `Backup #${id} not found`,
                messageAr: `النسخة الاحتياطية #${id} غير موجودة`,
            });
        }

        const token = this.tokenService.createToken(id);
        const expiresAt = new Date(Date.now() + 300 * 1000).toISOString();
        const url = `${baseUrl}/v1/system/backups/${id}/download?token=${token}`;

        return { url, expiresAt };
    }

    async streamBackupFile(id: number, token: string): Promise<{ filePath: string; filename: string }> {
        // Validate token
        this.tokenService.verifyToken(token, id);

        const run = await this.repo.findById(id);
        if (!run || !run.filename) {
            throw new NotFoundException({
                code: 'BACKUP_NOT_FOUND',
                message: `Backup #${id} not found`,
                messageAr: `النسخة الاحتياطية #${id} غير موجودة`,
            });
        }

        let pathVps = './data/backups';
        try {
            const s = await this.settings.getByKey('backup.path_vps');
            pathVps = String(s.value);
        } catch { /* use default */ }

        const backupDir = resolveBackupDir(pathVps);
        const filePath = path.join(backupDir, run.filename);

        if (!fs.existsSync(filePath)) {
            throw new NotFoundException({
                code: 'BACKUP_NOT_FOUND',
                message: 'Backup file not found on disk',
                messageAr: 'ملف النسخة الاحتياطية غير موجود',
            });
        }

        return { filePath, filename: run.filename };
    }
}

function removePathRecursive(targetPath: string): void {
    if (!fs.existsSync(targetPath)) return;
    fs.rmSync(targetPath, { recursive: true, force: true });
}

function copyPathRecursive(sourcePath: string, destinationPath: string): void {
    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
        fs.mkdirSync(destinationPath, { recursive: true });
        const entries = fs.readdirSync(sourcePath, { withFileTypes: true });
        for (const entry of entries) {
            const sourceEntryPath = path.join(sourcePath, entry.name);
            const destinationEntryPath = path.join(destinationPath, entry.name);
            copyPathRecursive(sourceEntryPath, destinationEntryPath);
        }
        return;
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
}

function isLikelySqliteFile(filePath: string): boolean {
    const SQLITE_HEADER = 'SQLite format 3\u0000';
    try {
        const fd = fs.openSync(filePath, 'r');
        try {
            const buffer = Buffer.alloc(SQLITE_HEADER.length);
            const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
            if (bytesRead < SQLITE_HEADER.length) return false;
            return buffer.toString('utf8') === SQLITE_HEADER;
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return false;
    }
}


