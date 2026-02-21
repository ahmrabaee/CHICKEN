import { describe, it, expect, vi } from 'vitest';
import { backupApi } from './backupApi';
import axiosInstance from '@/lib/axios';

vi.mock('@/lib/axios', () => ({
    default: {
        get: vi.fn(),
        put: vi.fn(),
        post: vi.fn(),
    },
}));

describe('backupApi', () => {
    it('getConfig calls correct endpoint', async () => {
        const mockData = { auto_enabled: true };
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: mockData });

        const result = await backupApi.getConfig();
        expect(axiosInstance.get).toHaveBeenCalledWith('/system/backup/config');
        expect(result).toEqual(mockData);
    });

    it('createManualBackup calls correct endpoint', async () => {
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: { message: 'ok' } });

        await backupApi.createManualBackup();
        expect(axiosInstance.post).toHaveBeenCalledWith('/system/backup', {});
    });

    it('createDownloadLink calls correct endpoint', async () => {
        const mockResult = { url: 'http://link', expiresAt: '2024-01-01' };
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: mockResult });

        const result = await backupApi.createDownloadLink(123);
        expect(axiosInstance.post).toHaveBeenCalledWith('/system/backups/123/download-link');
        expect(result).toEqual(mockResult);
    });

    it('restoreBackup calls correct endpoint', async () => {
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: { message: 'restored' } });

        const result = await backupApi.restoreBackup(7);
        expect(axiosInstance.post).toHaveBeenCalledWith('/system/backups/7/restore');
        expect(result).toEqual({ message: 'restored' });
    });

    it('importBackup calls correct endpoint with FormData and restore option', async () => {
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: { message: 'imported', backupId: 3, restored: true } });
        const file = new File(['backup-content'], 'backup.tar.gz', { type: 'application/gzip' });

        const result = await backupApi.importBackup(file, { restoreAfterImport: true });
        expect(axiosInstance.post).toHaveBeenCalledWith('/system/backups/import', expect.any(FormData));
        expect(result).toEqual({ message: 'imported', backupId: 3, restored: true });

        const postCalls = vi.mocked(axiosInstance.post).mock.calls;
        const formDataArg = postCalls[postCalls.length - 1]?.[1] as FormData;
        expect(formDataArg.get('restoreAfterImport')).toBe('true');
    });
});
