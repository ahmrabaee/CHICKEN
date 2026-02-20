import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { BackupService } from './backup.service';
import { SettingsService } from '../../settings/settings.service';
import {
    DEFAULT_AUTO_BACKUP_CRON,
    parseCronExpression,
    resolveAutoBackupCronExpression,
} from './utils/auto-backup-schedule';

const AUTO_BACKUP_JOB_NAME = 'auto-backup';

@Injectable()
export class BackupScheduler implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(BackupScheduler.name);
    private inFlightAutoBackup: Promise<void> | null = null;

    constructor(
        private backupService: BackupService,
        private settings: SettingsService,
        @Optional() private schedulerRegistry?: SchedulerRegistry,
    ) { }

    async onModuleInit() {
        if (!this.schedulerRegistry) {
            this.logger.warn('SchedulerRegistry unavailable; auto backup cron job was not registered');
            return;
        }

        const { cronExpression, source } = await this.resolveCronExpression();
        this.registerCronJob(cronExpression);
        this.logger.log(`Auto backup job registered (${source}): ${cronExpression}`);
    }

    onModuleDestroy() {
        this.removeCronJob();
    }

    async handleAutoBackup() {
        if (this.inFlightAutoBackup) {
            this.logger.warn('Scheduled backup skipped because a previous scheduled run is still in progress');
            return;
        }

        this.inFlightAutoBackup = this.executeAutoBackup();
        try {
            await this.inFlightAutoBackup;
        } finally {
            this.inFlightAutoBackup = null;
        }
    }

    private async executeAutoBackup() {
        this.logger.log('Scheduled backup triggered');

        let enabled = true;
        try {
            const setting = await this.settings.getByKey('backup.auto_enabled');
            enabled = setting.value === true || setting.value === 'true';
        } catch {
            this.logger.log('backup.auto_enabled not configured; defaulting to enabled');
        }

        if (!enabled) {
            this.logger.log('Auto backup is disabled - skipping');
            return;
        }

        try {
            await this.backupService.runBackup('auto');
            this.logger.log('Scheduled backup completed successfully');
        } catch (err: any) {
            const message =
                err instanceof Error
                    ? err.message
                    : typeof err === 'string'
                        ? err
                        : 'Unknown error';
            this.logger.error(`Scheduled backup failed: ${message}`, err instanceof Error ? err.stack : undefined);
        }
    }

    private async resolveCronExpression(): Promise<{
        cronExpression: string;
        source: 'env' | 'default';
    }> {
        const envCronRaw = process.env.BACKUP_SCHEDULE_CRON;
        const envCron = parseCronExpression(envCronRaw);
        if (envCron) {
            return { cronExpression: envCron, source: 'env' };
        }

        if (envCronRaw?.trim()) {
            this.logger.warn(
                `Invalid BACKUP_SCHEDULE_CRON "${envCronRaw}". Falling back to default ${DEFAULT_AUTO_BACKUP_CRON}.`,
            );
        }

        return {
            cronExpression: resolveAutoBackupCronExpression({
                envCron: process.env.BACKUP_SCHEDULE_CRON,
            }),
            source: 'default',
        };
    }

    private registerCronJob(cronExpression: string): void {
        if (!this.schedulerRegistry) return;

        this.removeCronJob();

        const job = CronJob.from({
            cronTime: cronExpression,
            onTick: () => {
                void this.handleAutoBackup();
            },
            start: true,
            name: AUTO_BACKUP_JOB_NAME,
        });

        this.schedulerRegistry.addCronJob(AUTO_BACKUP_JOB_NAME, job);
    }

    private removeCronJob(): void {
        if (!this.schedulerRegistry) return;
        if (!this.schedulerRegistry.doesExist('cron', AUTO_BACKUP_JOB_NAME)) return;

        const existingJob = this.schedulerRegistry.getCronJob(AUTO_BACKUP_JOB_NAME);
        existingJob.stop();
        this.schedulerRegistry.deleteCronJob(AUTO_BACKUP_JOB_NAME);
    }
}
