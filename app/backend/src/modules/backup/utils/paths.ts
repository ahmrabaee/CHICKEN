import * as path from 'path';
import * as fs from 'fs';

// Backend project root. Works in both src/* and dist/* runtime layouts.
const BACKEND_ROOT = path.resolve(__dirname, '../../../../');

export function resolveBackendRoot(): string {
    return BACKEND_ROOT;
}

export function resolveBackendPath(relativePath: string): string {
    return path.resolve(BACKEND_ROOT, relativePath);
}

export function toSqliteFileUrl(filePath: string): string {
    return `file:${filePath.replace(/\\/g, '/')}`;
}

/**
 * Resolves the SQLite database file path from DATABASE_URL env var.
 * DATABASE_URL is expected to be in the form: file:./data/app.db
 */
export function resolveDbPath(): string {
    const url = process.env.DATABASE_URL ?? 'file:./data/app.db';
    // Strip the "file:" prefix
    let relative = url.replace(/^file:/, '');

    // Relative sqlite URLs are resolved from prisma schema directory.
    if (relative.startsWith('./') || !path.isAbsolute(relative)) {
        return path.resolve(BACKEND_ROOT, 'prisma', relative);
    }

    return path.resolve(relative);
}

/**
 * Resolves the backup metadata SQLite database path.
 * Default: file:./data/backup-meta.db (relative to backend root).
 */
export function resolveBackupMetaDbPath(): string {
    const url = process.env.BACKUP_META_DATABASE_URL ?? 'file:./data/backup-meta.db';
    let relative = url.replace(/^file:/, '');

    if (relative.startsWith('./') || !path.isAbsolute(relative)) {
        return resolveBackendPath(relative);
    }

    return path.resolve(relative);
}

/**
 * Returns the absolute path to the backups directory.
 * Default: ./data/backups (relative to cwd)
 */
export function resolveBackupDir(customPath?: string): string {
    const dir = customPath ?? './data/backups';
    if (path.isAbsolute(dir)) return path.resolve(dir);
    return resolveBackendPath(dir);
}

/**
 * Returns the staging directory inside the backup dir.
 */
export function resolveStagingDir(backupDir: string): string {
    return path.join(backupDir, '.staging');
}

/**
 * Returns the lock file path inside the backup dir.
 */
export function resolveLockFile(backupDir: string): string {
    return path.join(backupDir, '.backup.lock');
}

/**
 * Ensures a directory exists (creates it recursively if needed).
 */
export function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Generates a timestamped backup filename.
 * Format: backup_auto_20240101_020000.tar.gz
 */
export function generateBackupFilename(type: 'auto' | 'manual'): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
        '_',
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds()),
    ].join('');
    return `backup_${type}_${timestamp}.tar.gz`;
}
