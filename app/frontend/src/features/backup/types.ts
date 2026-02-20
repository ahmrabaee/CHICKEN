export type BackupRunType = 'auto' | 'manual';
export type BackupRunStatus = 'running' | 'success' | 'failed';

export interface BackupRun {
    id: number;
    type: BackupRunType;
    status: BackupRunStatus;
    startedAt: string;
    finishedAt: string | null;
    filename: string | null;
    sizeBytes: number | null;
    checksumSha256: string | null;
    errorMessage: string | null;
    createdAt: string;
}

export interface BackupConfig {
    auto_enabled: boolean;
    schedule_time: string;
    retention_count: number;
    scope: string;
    path_vps: string;
    last_success_at: string | null;
    last_failure_at: string | null;
    last_error: string | null;
}

export interface BackupSystemStatus {
    running: boolean;
    last_success_at: string | null;
    last_failure_at: string | null;
    last_error: string | null;
    next_run_at: string | null;
    auto_enabled: boolean;
}

export interface BackupListResult {
    items: BackupRun[];
    total: number;
    page: number;
    limit: number;
}

export interface BackupListQuery {
    page?: number;
    limit?: number;
    type?: BackupRunType;
    status?: BackupRunStatus;
}

export interface DownloadLink {
    url: string;
    expiresAt: string;
}
