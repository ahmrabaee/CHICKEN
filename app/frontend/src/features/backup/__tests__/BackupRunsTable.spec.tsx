import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BackupRunsTable } from '../components/BackupRunsTable';
import { BackupRun } from '../types';
import '@testing-library/jest-dom';

describe('BackupRunsTable', () => {
    const mockRuns: BackupRun[] = [
        {
            id: 1,
            type: 'manual',
            status: 'success',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            filename: 'test.tar.gz',
            sizeBytes: 1024 * 1024,
            checksumSha256: 'abc',
            errorMessage: null,
            createdAt: new Date().toISOString(),
        },
    ];

    it('renders "no runs" message when empty', () => {
        render(<BackupRunsTable runs={[]} isLoading={false} />);
        expect(screen.getByText(/لا يوجد سجلات نسخ احتياطي بعد/i)).toBeInTheDocument();
    });

    it('renders rows with correct data', () => {
        render(<BackupRunsTable runs={mockRuns} isLoading={false} />);
        expect(screen.getByText(/يدوي/i)).toBeInTheDocument();
        expect(screen.getByText(/ناجح/i)).toBeInTheDocument();
        expect(screen.getByText(/1.00 MB/i)).toBeInTheDocument();
    });

    it('shows loader when isLoading is true', () => {
        render(<BackupRunsTable runs={[]} isLoading={true} />);
        // Since it's a lucide-react icon, we check for role or generic parent
        const tableCells = screen.getAllByRole('cell');
        expect(tableCells[0]).toContainHTML('svg');
    });
});
