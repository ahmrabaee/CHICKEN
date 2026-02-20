import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BackupSettingsTab } from '../components/BackupSettingsTab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

const refetchRunsMock = vi.fn().mockResolvedValue({ data: { items: [], total: 0 }, error: null });
let mockStatusData: { running: boolean; last_success_at: string | null; last_error: string | null; next_run_at: string | null } = {
  running: false,
  last_success_at: null,
  last_error: null,
  next_run_at: null,
};

vi.mock('../hooks/useBackupConfig', () => ({
  useBackupConfig: () => ({
    data: { auto_enabled: true, schedule_time: '02:00', retention_count: 15 },
    isLoading: false,
  }),
  useUpdateBackupConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../hooks/useBackupStatus', () => ({
  useBackupStatus: () => ({
    data: mockStatusData,
    isLoading: false,
  }),
}));

vi.mock('../hooks/useBackupRuns', () => ({
  useBackupRuns: () => ({
    data: { items: [], total: 0 },
    isLoading: false,
    refetch: refetchRunsMock,
  }),
}));

vi.mock('../api/backupApi', () => ({
  backupApi: {
    createManualBackup: vi.fn().mockResolvedValue({ message: 'ok' }),
    importBackup: vi.fn().mockResolvedValue({ message: 'ok' }),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('BackupSettingsTab', () => {
  beforeEach(() => {
    refetchRunsMock.mockClear();
    mockStatusData = {
      running: false,
      last_success_at: null,
      last_error: null,
      next_run_at: null,
    };
  });

  const renderWithQueryClient = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <BackupSettingsTab />
      </QueryClientProvider>,
    );
  };

  it('renders essential panels', () => {
    renderWithQueryClient();

    expect(screen.getByText(/إعدادات النسخ الاحتياطي/i)).toBeInTheDocument();
    expect(screen.getByText(/حالة النظام/i)).toBeInTheDocument();
    expect(screen.getByText(/سجل العمليات/i)).toBeInTheDocument();
  });

  it('shows scheduled time and retention count', () => {
    renderWithQueryClient();

    expect(screen.getAllByText('02:00')[0]).toBeInTheDocument();
    expect(screen.getAllByText(/15 يوم/i)[0]).toBeInTheDocument();
  });

  it('has trigger button enabled when not running', () => {
    renderWithQueryClient();

    const btn = screen.getByText(/بدء نسخ احتياطي الآن/i);
    expect(btn).not.toBeDisabled();
  });

  it('shows effective runtime schedule time from next_run_at when available', () => {
    mockStatusData = {
      running: false,
      last_success_at: null,
      last_error: null,
      next_run_at: '2026-02-20T01:18:00',
    };

    renderWithQueryClient();

    expect(screen.getAllByText('01:18')[0]).toBeInTheDocument();
  });

  it('manual backup action triggers runs refetch', async () => {
    renderWithQueryClient();

    const manualBackupButton = screen.getByRole('button', { name: /بدء نسخ احتياطي الآن/i });
    fireEvent.click(manualBackupButton);

    await waitFor(() => {
      expect(refetchRunsMock).toHaveBeenCalledTimes(1);
    });
  });
});
