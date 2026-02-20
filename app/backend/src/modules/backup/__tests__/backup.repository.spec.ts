import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupRepository } from '../backup.repository';

describe('BackupRepository', () => {
    const prisma = {
        backupRun: {
            create: vi.fn(),
            update: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
            delete: vi.fn(),
            findFirst: vi.fn(),
            updateMany: vi.fn(),
        },
    };

    let repo: BackupRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new BackupRepository(prisma as any);
    });

    it('createRun persists run with provided type/status', async () => {
        prisma.backupRun.create.mockResolvedValue({ id: 1 });

        await repo.createRun({ type: 'manual', status: 'running' });

        expect(prisma.backupRun.create).toHaveBeenCalledWith({
            data: { type: 'manual', status: 'running' },
        });
    });

    it('updateRun forwards partial payload', async () => {
        prisma.backupRun.update.mockResolvedValue({});
        const finishedAt = new Date();

        await repo.updateRun(7, { status: 'success', finishedAt });

        expect(prisma.backupRun.update).toHaveBeenCalledWith({
            where: { id: 7 },
            data: { status: 'success', finishedAt },
        });
    });

    it('findAll applies filters and pagination', async () => {
        prisma.backupRun.findMany.mockResolvedValue([]);
        prisma.backupRun.count.mockResolvedValue(0);

        const result = await repo.findAll({
            page: 2,
            limit: 5,
            type: 'auto',
            status: 'success',
        });

        expect(prisma.backupRun.findMany).toHaveBeenCalledWith({
            where: { type: 'auto', status: 'success' },
            orderBy: { startedAt: 'desc' },
            skip: 5,
            take: 5,
        });
        expect(prisma.backupRun.count).toHaveBeenCalledWith({
            where: { type: 'auto', status: 'success' },
        });
        expect(result).toEqual({
            items: [],
            total: 0,
            page: 2,
            limit: 5,
        });
    });

    it('findSuccessfulRunsBefore queries successful runs older than cutoff', async () => {
        prisma.backupRun.findMany.mockResolvedValue([]);
        const cutoff = new Date('2026-02-01T00:00:00.000Z');

        await repo.findSuccessfulRunsBefore(cutoff);

        expect(prisma.backupRun.findMany).toHaveBeenCalledWith({
            where: {
                status: 'success',
                finishedAt: { lt: cutoff },
            },
            orderBy: { startedAt: 'desc' },
        });
    });

    it('findRunningBackup returns latest running record', async () => {
        prisma.backupRun.findFirst.mockResolvedValue({ id: 3 });

        await repo.findRunningBackup();

        expect(prisma.backupRun.findFirst).toHaveBeenCalledWith({
            where: { status: 'running' },
            orderBy: { startedAt: 'desc' },
        });
    });

    it('failAllRunningBackups updates all running records', async () => {
        prisma.backupRun.updateMany.mockResolvedValue({ count: 2 });

        await repo.failAllRunningBackups('stale');

        expect(prisma.backupRun.updateMany).toHaveBeenCalledWith({
            where: { status: 'running' },
            data: {
                status: 'failed',
                finishedAt: expect.any(Date),
                errorMessage: 'stale',
            },
        });
    });
});
