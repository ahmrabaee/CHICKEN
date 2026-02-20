import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BackupAutoSyncAgent } from '../components/BackupAutoSyncAgent';

const mockListRuns = vi.fn();
const mockCreateDownloadLink = vi.fn();
const mockToastSuccess = vi.fn();

let authState = {
  isAuthenticated: true,
  user: { role: 'admin' },
};
const storage = new Map<string, string>();

vi.mock('../api/backupApi', () => ({
  backupApi: {
    listRuns: (...args: any[]) => mockListRuns(...args),
    createDownloadLink: (...args: any[]) => mockCreateDownloadLink(...args),
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: vi.fn(),
  },
}));

function makeRun(id: number) {
  return {
    id,
    type: 'auto',
    status: 'success',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    filename: `backup_auto_${id}.tar.gz`,
    sizeBytes: 100,
    checksumSha256: 'sha',
    errorMessage: null,
    createdAt: new Date().toISOString(),
  };
}

function renderAgent() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BackupAutoSyncAgent />
    </QueryClientProvider>,
  );
}

describe('BackupAutoSyncAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, String(value));
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    });
    authState = {
      isAuthenticated: true,
      user: { role: 'admin' },
    };
    (window as any).__TAURI__ = {};

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName as any, options as any);
      if (String(tagName).toLowerCase() === 'a') {
        (element as HTMLAnchorElement).click = vi.fn();
      }
      return element;
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as any).__TAURI__;
    delete (window as any).__TAURI_INTERNALS__;
  });

  it('downloads the latest successful auto backup for connected desktop admin', async () => {
    mockListRuns.mockResolvedValue({
      items: [makeRun(20)],
      total: 1,
      page: 1,
      limit: 5,
    });
    mockCreateDownloadLink.mockResolvedValue({
      url: 'http://localhost/download/20',
      expiresAt: new Date().toISOString(),
    });

    renderAgent();

    await waitFor(() => {
      expect(mockListRuns).toHaveBeenCalledWith({
        page: 1,
        limit: 5,
        type: 'auto',
        status: 'success',
      });
    });

    await waitFor(() => {
      expect(mockCreateDownloadLink).toHaveBeenCalledWith(20);
    });

    expect(localStorage.getItem('backup.lastSyncedAutoBackupId')).toBe('20');
  });

  it('skips download if latest auto backup was already synced locally', async () => {
    localStorage.setItem('backup.lastSyncedAutoBackupId', '20');
    mockListRuns.mockResolvedValue({
      items: [makeRun(20)],
      total: 1,
      page: 1,
      limit: 5,
    });

    renderAgent();

    await waitFor(() => {
      expect(mockListRuns).toHaveBeenCalled();
    });

    expect(mockCreateDownloadLink).not.toHaveBeenCalled();
  });

  it('does not run sync logic when not in desktop runtime', async () => {
    delete (window as any).__TAURI__;
    delete (window as any).__TAURI_INTERNALS__;
    mockListRuns.mockResolvedValue({
      items: [makeRun(10)],
      total: 1,
      page: 1,
      limit: 5,
    });

    renderAgent();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockListRuns).not.toHaveBeenCalled();
    expect(mockCreateDownloadLink).not.toHaveBeenCalled();
  });

  it('syncs latest backup after reconnecting (was disconnected at backup time)', async () => {
    authState.isAuthenticated = false;
    mockListRuns.mockResolvedValue({
      items: [makeRun(30)],
      total: 1,
      page: 1,
      limit: 5,
    });
    mockCreateDownloadLink.mockResolvedValue({
      url: 'http://localhost/download/30',
      expiresAt: new Date().toISOString(),
    });

    const view = renderAgent();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockListRuns).not.toHaveBeenCalled();

    authState.isAuthenticated = true;
    view.rerender(
      <QueryClientProvider client={new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      })}>
        <BackupAutoSyncAgent />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockCreateDownloadLink).toHaveBeenCalledWith(30);
    });
    expect(localStorage.getItem('backup.lastSyncedAutoBackupId')).toBe('30');
  });

  it('does not sync for non-admin users', async () => {
    authState.user = { role: 'cashier' };
    mockListRuns.mockResolvedValue({
      items: [makeRun(50)],
      total: 1,
      page: 1,
      limit: 5,
    });

    renderAgent();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockListRuns).not.toHaveBeenCalled();
    expect(mockCreateDownloadLink).not.toHaveBeenCalled();
  });
});
