import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupScheduler } from '../backup.scheduler';

describe('BackupScheduler', () => {
    const originalBackupCron = process.env.BACKUP_SCHEDULE_CRON;

    const backupService = {
        runBackup: vi.fn(),
    };

    const settings = {
        getByKey: vi.fn(),
    };

    const schedulerRegistry = {
        addCronJob: vi.fn(),
        doesExist: vi.fn().mockReturnValue(false),
        getCronJob: vi.fn(),
        deleteCronJob: vi.fn(),
    };

    let scheduler: BackupScheduler;
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.BACKUP_SCHEDULE_CRON;
        scheduler = new BackupScheduler(
            backupService as any,
            settings as any,
            schedulerRegistry as any,
        );
        logSpy = vi.spyOn((scheduler as any).logger, 'log').mockImplementation(() => undefined);
        errorSpy = vi.spyOn((scheduler as any).logger, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        if (originalBackupCron === undefined) {
            delete process.env.BACKUP_SCHEDULE_CRON;
        } else {
            process.env.BACKUP_SCHEDULE_CRON = originalBackupCron;
        }
    });

    it('registers auto backup cron job from BACKUP_SCHEDULE_CRON on module init', async () => {
        process.env.BACKUP_SCHEDULE_CRON = '*/5 * * * *';
        settings.getByKey.mockResolvedValue({ value: '02:00' });

        await scheduler.onModuleInit();

        expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(1);
        const [, job] = schedulerRegistry.addCronJob.mock.calls[0];
        expect((job as any).cronTime?.source).toBe('*/5 * * * *');
        (job as any).stop?.();
    });

    it('registers default auto backup cron job when env cron is missing', async () => {
        await scheduler.onModuleInit();

        expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(1);
        const [, job] = schedulerRegistry.addCronJob.mock.calls[0];
        expect((job as any).cronTime?.source).toBe('0 2 * * *');
        expect(settings.getByKey).not.toHaveBeenCalledWith('backup.schedule_time');
        (job as any).stop?.();
    });

    it('runs auto backup when backup.auto_enabled is true', async () => {
        settings.getByKey.mockResolvedValue({ value: true });
        backupService.runBackup.mockResolvedValue(undefined);

        await scheduler.handleAutoBackup();

        expect(backupService.runBackup).toHaveBeenCalledWith('auto');
    });

    it('runs auto backup when setting is missing (default enabled)', async () => {
        settings.getByKey.mockRejectedValue(new Error('not found'));
        backupService.runBackup.mockResolvedValue(undefined);

        await scheduler.handleAutoBackup();

        expect(backupService.runBackup).toHaveBeenCalledWith('auto');
    });

    it('skips auto backup when backup.auto_enabled is false', async () => {
        settings.getByKey.mockResolvedValue({ value: false });

        await scheduler.handleAutoBackup();

        expect(backupService.runBackup).not.toHaveBeenCalled();
    });

    it('accepts string true for backup.auto_enabled', async () => {
        settings.getByKey.mockResolvedValue({ value: 'true' });
        backupService.runBackup.mockResolvedValue(undefined);

        await scheduler.handleAutoBackup();

        expect(backupService.runBackup).toHaveBeenCalledWith('auto');
    });

    it('swallows backup execution errors', async () => {
        settings.getByKey.mockResolvedValue({ value: true });
        backupService.runBackup.mockRejectedValue(new Error('simulated scheduler failure'));

        await expect(scheduler.handleAutoBackup()).resolves.toBeUndefined();
        expect(backupService.runBackup).toHaveBeenCalledWith('auto');
        expect(errorSpy).toHaveBeenCalledWith(
            'Scheduled backup failed: simulated scheduler failure',
            expect.any(String),
        );
    });
});
