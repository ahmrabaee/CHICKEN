import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountValidatorService } from './account-validator.service';
import { AccountRepository } from './account.repository';
import { AccountTreeBuilderService } from './account-tree-builder.service';

describe('AccountValidatorService', () => {
    let service: AccountValidatorService;
    let repository: AccountRepository;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AccountValidatorService,
                {
                    provide: AccountRepository,
                    useValue: {
                        findByCodeAndCompany: vi.fn(),
                        findById: vi.fn(),
                        hasJournalEntries: vi.fn(),
                        hasChildAccounts: vi.fn(),
                        findAncestors: vi.fn(),
                    },
                },
                {
                    provide: AccountTreeBuilderService,
                    useValue: {
                        deriveRootAndReportType: vi.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<AccountValidatorService>(AccountValidatorService);
        repository = module.get<AccountRepository>(AccountRepository);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('validateCreate', () => {
        it('should throw if code already exists', async () => {
            vi.mocked(repository.findByCodeAndCompany).mockResolvedValue({ id: 1, code: '1000' } as any);

            await expect(service.validateCreate({ code: '1000', name: 'Test' } as any, 1))
                .rejects.toThrow();
        });

        it('should throw if parent not found', async () => {
            vi.mocked(repository.findByCodeAndCompany).mockResolvedValue(null);
            vi.mocked(repository.findById).mockResolvedValue(null);

            await expect(service.validateCreate({ code: '1000', name: 'Test', parentId: 999 } as any, 1))
                .rejects.toThrow();
        });

        it('should throw if parent is not a group', async () => {
            vi.mocked(repository.findById).mockResolvedValue({ id: 999, isGroup: false, companyId: 1 } as any);

            await expect(service.validateCreate({ code: '1001', name: 'Test', parentId: 999 } as any, 1))
                .rejects.toThrow();
        });
    });

    describe('validateUpdate', () => {
        it('should throw if cycle detected', async () => {
            vi.mocked(repository.findById).mockResolvedValueOnce({ id: 1, parentId: null } as any);
            vi.mocked(repository.findById).mockResolvedValueOnce({ id: 999, isGroup: true } as any);
            vi.mocked(repository.findAncestors).mockResolvedValue([{ id: 1 }] as any);

            await expect(service.validateUpdate(1, { parentId: 999 } as any, 1))
                .rejects.toThrow();
        });
    });

    describe('validateForDeletion', () => {
        it('should throw if account has journal entries', async () => {
            vi.mocked(repository.hasJournalEntries).mockResolvedValue(true);

            await expect(service.validateForDeletion(1))
                .rejects.toThrow();
        });
    });
});
