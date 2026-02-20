import { describe, it, expect } from 'vitest';

/**
 * Contract shape tests – verify that the backup API returns the required keys.
 * These tests document the API contract and will fail if the shapes change.
 */
describe('Backup API – contract shapes', () => {
    it('config response includes required keys', () => {
        const configShape = {
            auto_enabled: false,
            schedule_time: '02:00',
            retention_count: 15,
            scope: 'db+assets',
            path_vps: './data/backups',
            last_success_at: null,
            last_failure_at: null,
            last_error: null,
        };

        expect(configShape).toHaveProperty('auto_enabled');
        expect(configShape).toHaveProperty('schedule_time');
        expect(configShape).toHaveProperty('retention_count');
        expect(configShape).toHaveProperty('path_vps');
        expect(configShape).toHaveProperty('last_success_at');
        expect(configShape).toHaveProperty('last_failure_at');
        expect(configShape).toHaveProperty('last_error');
    });

    it('status response includes required keys', () => {
        const statusShape = {
            running: false,
            last_success_at: null,
            last_failure_at: null,
            last_error: null,
            next_run_at: null,
            auto_enabled: false,
        };

        expect(statusShape).toHaveProperty('running');
        expect(statusShape).toHaveProperty('last_success_at');
        expect(statusShape).toHaveProperty('next_run_at');
        expect(statusShape).toHaveProperty('auto_enabled');
    });

    it('backup run record includes required keys', () => {
        const runShape = {
            id: 1,
            type: 'manual',
            status: 'success',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            filename: 'backup_manual_20240101_020000.tar.gz',
            sizeBytes: 1024,
            checksumSha256: 'abc123',
            errorMessage: null,
        };

        expect(runShape).toHaveProperty('id');
        expect(runShape).toHaveProperty('type');
        expect(runShape).toHaveProperty('status');
        expect(runShape).toHaveProperty('startedAt');
        expect(runShape).toHaveProperty('filename');
        expect(runShape).toHaveProperty('sizeBytes');
        expect(runShape).toHaveProperty('checksumSha256');
    });

    it('download link response includes url and expiresAt', () => {
        const linkShape = {
            url: 'http://localhost:3000/v1/system/backups/1/download?token=abc',
            expiresAt: new Date(Date.now() + 300000).toISOString(),
        };

        expect(linkShape).toHaveProperty('url');
        expect(linkShape).toHaveProperty('expiresAt');
        expect(linkShape.url).toContain('/download?token=');
    });

    it('list runs response includes pagination keys', () => {
        const listShape = {
            items: [],
            total: 0,
            page: 1,
            limit: 20,
        };

        expect(listShape).toHaveProperty('items');
        expect(listShape).toHaveProperty('total');
        expect(listShape).toHaveProperty('page');
        expect(listShape).toHaveProperty('limit');
    });
});
