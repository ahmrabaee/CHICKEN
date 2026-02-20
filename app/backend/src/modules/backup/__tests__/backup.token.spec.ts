import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { BackupTokenService } from '../security/backup-token.service';

function makeService(secret = 'test-secret') {
    const config = {
        get: (key: string, fallback: string) => (key === 'BACKUP_DOWNLOAD_SECRET' ? secret : fallback),
    } as unknown as ConfigService;
    return new BackupTokenService(config);
}

describe('BackupTokenService', () => {
    let svc: BackupTokenService;

    beforeEach(() => {
        svc = makeService();
    });

    it('signs and verifies a token', () => {
        const token = svc.createToken(42);
        expect(token).toContain('.');
        const payload = svc.verifyToken(token, 42);
        expect(payload.backupId).toBe(42);
    });

    it('rejects a tampered signature', () => {
        const token = svc.createToken(42);
        const [payload] = token.split('.');
        const tampered = `${payload}.invalidsignature`;
        expect(() => svc.verifyToken(tampered, 42)).toThrow();
    });

    it('rejects an expired token', () => {
        const token = svc.createToken(42, -1); // already expired
        expect(() => svc.verifyToken(token, 42)).toThrow();
    });

    it('rejects token with wrong backupId', () => {
        const token = svc.createToken(42);
        expect(() => svc.verifyToken(token, 99)).toThrow();
    });

    it('rejects malformed token (no dot)', () => {
        expect(() => svc.verifyToken('nodothere', 42)).toThrow();
    });
});
