import { afterEach, describe, expect, it } from 'vitest';
import * as path from 'path';
import {
    resolveBackupDir,
    resolveBackupMetaDbPath,
    resolveBackendPath,
    resolveDbPath,
} from '../utils/paths';

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_DB_URL = process.env.DATABASE_URL;
const ORIGINAL_BACKUP_META_DB_URL = process.env.BACKUP_META_DATABASE_URL;

afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    if (ORIGINAL_DB_URL === undefined) {
        delete process.env.DATABASE_URL;
    } else {
        process.env.DATABASE_URL = ORIGINAL_DB_URL;
    }
    if (ORIGINAL_BACKUP_META_DB_URL === undefined) {
        delete process.env.BACKUP_META_DATABASE_URL;
    } else {
        process.env.BACKUP_META_DATABASE_URL = ORIGINAL_BACKUP_META_DB_URL;
    }
});

describe('backup paths', () => {
    it('resolves DB path relative to backend root (not current cwd)', () => {
        process.env.DATABASE_URL = 'file:./data/app.db';
        process.chdir(path.parse(ORIGINAL_CWD).root);

        expect(resolveDbPath()).toBe(resolveBackendPath('./prisma/data/app.db'));
    });

    it('resolves backup directory relative to backend root', () => {
        expect(resolveBackupDir('./data/backups')).toBe(resolveBackendPath('./data/backups'));
    });

    it('keeps absolute backup directory as-is', () => {
        const absolute = path.resolve(path.parse(ORIGINAL_CWD).root, 'tmp', 'custom-backups');
        expect(resolveBackupDir(absolute)).toBe(absolute);
    });

    it('resolves backup metadata DB path relative to backend root', () => {
        process.env.BACKUP_META_DATABASE_URL = 'file:./data/backup-meta.db';
        process.chdir(path.parse(ORIGINAL_CWD).root);

        expect(resolveBackupMetaDbPath()).toBe(resolveBackendPath('./data/backup-meta.db'));
    });
});
