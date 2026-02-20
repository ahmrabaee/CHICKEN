import { CronTime } from 'cron';

export const DEFAULT_AUTO_BACKUP_CRON = '0 2 * * *';

const DAILY_TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function parseCronExpression(value?: string | null): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;

    return CronTime.validateCronExpression(trimmed).valid ? trimmed : null;
}

export function scheduleTimeToCronExpression(scheduleTime?: string | null): string | null {
    const trimmed = scheduleTime?.trim();
    if (!trimmed) return null;

    const match = DAILY_TIME_PATTERN.exec(trimmed);
    if (!match) return null;

    const [, hourRaw, minuteRaw] = match;
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    return `${minute} ${hour} * * *`;
}

export function resolveAutoBackupCronExpression(options?: {
    envCron?: string | null;
    scheduleTime?: string | null;
}): string {
    return (
        parseCronExpression(options?.envCron) ??
        scheduleTimeToCronExpression(options?.scheduleTime) ??
        DEFAULT_AUTO_BACKUP_CRON
    );
}

export function computeNextRunAt(cronExpression: string, now = new Date()): string | null {
    try {
        return new CronTime(cronExpression).getNextDateFrom(now).toJSDate().toISOString();
    } catch {
        return null;
    }
}
