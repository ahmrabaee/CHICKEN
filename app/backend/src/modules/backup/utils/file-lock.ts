import * as fs from 'fs';

const LOCK_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Attempts to acquire a file lock.
 * Returns true if lock was acquired, false if already locked.
 */
export function acquireLock(lockFile: string): boolean {
    if (fs.existsSync(lockFile)) {
        try {
            const content = fs.readFileSync(lockFile, 'utf-8');
            const ts = parseInt(content.trim(), 10);
            if (!isNaN(ts) && Date.now() - ts < LOCK_TTL_MS) {
                // Lock is still fresh
                return false;
            }
            // Lock is stale – remove it
            fs.unlinkSync(lockFile);
        } catch {
            // If we can't read/parse, treat as stale
            try { fs.unlinkSync(lockFile); } catch { /* ignore */ }
        }
    }

    try {
        fs.writeFileSync(lockFile, String(Date.now()), { flag: 'wx' });
        return true;
    } catch {
        // Another process created the file between our check and write
        return false;
    }
}

/**
 * Releases the file lock.
 */
export function releaseLock(lockFile: string): void {
    try {
        if (fs.existsSync(lockFile)) {
            fs.unlinkSync(lockFile);
        }
    } catch { /* ignore */ }
}

/**
 * Returns true if a valid (non-stale) lock exists.
 */
export function isLocked(lockFile: string): boolean {
    if (!fs.existsSync(lockFile)) return false;
    try {
        const content = fs.readFileSync(lockFile, 'utf-8');
        const ts = parseInt(content.trim(), 10);
        return !isNaN(ts) && Date.now() - ts < LOCK_TTL_MS;
    } catch {
        return false;
    }
}
