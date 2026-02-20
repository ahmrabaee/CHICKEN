import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { backupApi } from '../api/backupApi';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const LAST_SYNCED_AUTO_BACKUP_KEY = 'backup.lastSyncedAutoBackupId';
const AUTO_SYNC_POLL_MS = 30_000;

function isDesktopRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const runtime = window as typeof window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  const userAgent = navigator.userAgent.toLowerCase();
  return Boolean(runtime.__TAURI__ || runtime.__TAURI_INTERNALS__ || userAgent.includes('tauri'));
}

function triggerDownload(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', '');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function BackupAutoSyncAgent() {
  const { isAuthenticated, user } = useAuth();
  const desktopRuntime = useMemo(() => isDesktopRuntime(), []);
  const isEnabled = isAuthenticated && user?.role === 'admin' && desktopRuntime;
  const syncingRunIdRef = useRef<number | null>(null);

  const { data } = useQuery({
    queryKey: ['backup', 'auto-sync-latest-run'],
    queryFn: () => backupApi.listRuns({ page: 1, limit: 5, type: 'auto', status: 'success' }),
    enabled: isEnabled,
    staleTime: 10_000,
    refetchInterval: AUTO_SYNC_POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });

  useEffect(() => {
    if (!isEnabled) return;
    const latestRun = data?.items?.[0];
    if (!latestRun?.id) return;

    const lastSyncedRunId = Number(localStorage.getItem(LAST_SYNCED_AUTO_BACKUP_KEY) ?? '0');
    if (latestRun.id <= lastSyncedRunId) return;
    if (syncingRunIdRef.current === latestRun.id) return;

    syncingRunIdRef.current = latestRun.id;
    let cancelled = false;

    (async () => {
      try {
        const { url } = await backupApi.createDownloadLink(latestRun.id);
        if (cancelled) return;

        triggerDownload(url);
        localStorage.setItem(LAST_SYNCED_AUTO_BACKUP_KEY, String(latestRun.id));
        toast.success('تمت مزامنة النسخة الاحتياطية التلقائية إلى هذا الجهاز');
      } catch (error) {
        console.error('Auto backup sync failed', error);
      } finally {
        if (syncingRunIdRef.current === latestRun.id) {
          syncingRunIdRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data?.items, isEnabled]);

  return null;
}
