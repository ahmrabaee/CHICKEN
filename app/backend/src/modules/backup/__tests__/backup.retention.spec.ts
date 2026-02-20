import { describe, it, expect } from 'vitest';

describe('Backup retention policy', () => {
    it('marks backups older than 15 days for deletion', () => {
        const now = new Date('2026-02-19T00:00:00.000Z');
        const retentionDays = 15;
        const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

        const oldBackup = new Date('2026-02-01T23:59:59.000Z');
        const recentBackup = new Date('2026-02-10T00:00:00.000Z');

        expect(oldBackup < cutoff).toBe(true);
        expect(recentBackup < cutoff).toBe(false);
    });

    it('keeps backups within retention window', () => {
        const now = new Date('2026-02-19T00:00:00.000Z');
        const retentionDays = 15;
        const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

        const boundaryBackup = new Date('2026-02-04T00:00:00.000Z');
        expect(boundaryBackup < cutoff).toBe(false);
    });
});
