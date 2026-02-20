import * as fs from 'fs';
import * as path from 'path';
import { resolveDbPath, ensureDir } from './paths';

/**
 * Creates a WAL-safe snapshot of the SQLite database.
 *
 * Steps:
 * 1. Run PRAGMA wal_checkpoint(TRUNCATE) via raw SQL (done externally by BackupService)
 * 2. Copy the DB file to a staging temp location
 *
 * @param stagingDir - directory to write the snapshot into
 * @param timestamp  - timestamp string used in the filename
 * @returns the absolute path to the snapshot file
 */
export async function createSqliteSnapshot(
    stagingDir: string,
    timestamp: string,
): Promise<string> {
    const dbPath = resolveDbPath();

    if (!fs.existsSync(dbPath)) {
        throw new Error(`Database file not found at: ${dbPath}`);
    }

    ensureDir(stagingDir);

    const snapshotPath = path.join(stagingDir, `app-${timestamp}.db`);

    await fs.promises.copyFile(dbPath, snapshotPath);

    const stat = await fs.promises.stat(snapshotPath);
    if (stat.size === 0) {
        throw new Error('SQLite snapshot is empty – copy failed');
    }

    return snapshotPath;
}
