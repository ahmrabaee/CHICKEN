import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountTreeBuilderService } from './account-tree-builder.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AccountTreeBuilderService', () => {
    let service: AccountTreeBuilderService;
    let prisma: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AccountTreeBuilderService,
                {
                    provide: PrismaService,
                    useValue: {
                        account: {
                            findMany: vi.fn(),
                            update: vi.fn(),
                        },
                        $transaction: vi.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<AccountTreeBuilderService>(AccountTreeBuilderService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    describe('deriveRootAndReportType', () => {
        it('should return Asset for bank account', () => {
            const result = service.deriveRootAndReportType('Bank');
            expect(result.rootType).toBe('Asset');
            expect(result.reportType).toBe('Balance Sheet');
        });

        it('should return Expense for Cost of Goods Sold', () => {
            const result = service.deriveRootAndReportType('Cost of Goods Sold');
            expect(result.rootType).toBe('Expense');
            expect(result.reportType).toBe('Profit and Loss');
        });

        it('should inherit from parent if type is unknown', () => {
            const parent = { rootType: 'Liability' } as any;
            const result = service.deriveRootAndReportType('Unknown', parent);
            expect(result.rootType).toBe('Liability');
            expect(result.reportType).toBe('Balance Sheet');
        });
    });

    describe('rebuildNestedSet', () => {
        it('should assign correct lft/rgt values for a simple tree', async () => {
            const mockAccounts = [
                { id: 1, code: '1000', parentId: null },
                { id: 2, code: '1100', parentId: 1 },
                { id: 3, code: '1200', parentId: 1 },
            ] as any[];

            vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts);
            vi.mocked(prisma.$transaction).mockImplementation(async (val) => {
                if (Array.isArray(val)) return Promise.all(val);
                return val;
            });
            // We cast to any to satisfy Prisma's complex return type expectations
            vi.mocked(prisma.account.update).mockImplementation((args) => Promise.resolve(args) as any);

            await service.rebuildNestedSet(1);

            expect(prisma.account.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 1 },
                data: { lft: 1, rgt: 6 },
            }));
            expect(prisma.account.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 2 },
                data: { lft: 2, rgt: 3 },
            }));
            expect(prisma.account.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 3 },
                data: { lft: 4, rgt: 5 },
            }));
        });
    });
});
