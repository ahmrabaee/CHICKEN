import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountRepository } from './account.repository';
import { AccountTreeBuilderService } from './account-tree-builder.service';
import { AccountValidatorService } from './account-validator.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

const DEFAULT_COMPANY_ID = 1;

@Injectable()
export class ChartOfAccountsService {
  constructor(
    private prisma: PrismaService,
    private accountRepo: AccountRepository,
    private treeBuilder: AccountTreeBuilderService,
    private validator: AccountValidatorService,
  ) {}

  async getAccounts(companyId: number | null = DEFAULT_COMPANY_ID, postableOnly = false) {
    const where: { companyId: number | null; isActive?: boolean; isGroup?: boolean } = {
      companyId,
      isActive: true,
    };
    if (postableOnly) where.isGroup = false;

    return this.prisma.account.findMany({
      where,
      include: { parent: true, childAccounts: true },
      orderBy: { lft: 'asc' },
    });
  }

  async getAccountById(id: number) {
    const account = await this.accountRepo.findById(id);
    if (!account) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Account not found', messageAr: 'الحساب غير موجود' });
    }
    return account;
  }

  async getAccountByCode(code: string, companyId: number | null = DEFAULT_COMPANY_ID) {
    const account = await this.accountRepo.findByCodeAndCompany(code, companyId);
    if (!account) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Account not found', messageAr: 'الحساب غير موجود' });
    }
    return this.prisma.account.findUnique({
      where: { id: account.id },
      include: { parent: true, childAccounts: true },
    });
  }

  /** Backward compatibility: param can be numeric id or account code */
  async getAccountByCodeOrId(param: string, companyId: number | null = DEFAULT_COMPANY_ID) {
    const numericId = parseInt(param, 10);
    if (!Number.isNaN(numericId)) {
      const byId = await this.accountRepo.findById(numericId);
      if (byId) return this.prisma.account.findUnique({
        where: { id: numericId },
        include: { parent: true, childAccounts: true },
      });
    }
    return this.getAccountByCode(param, companyId);
  }

  async canDelete(id: number) {
    const hasEntries = await this.accountRepo.hasJournalEntries(id);
    const hasChildren = await this.accountRepo.hasChildAccounts(id);
    return { canDelete: !hasEntries && !hasChildren, hasEntries, hasChildren };
  }

  async createAccount(dto: CreateAccountDto, companyId: number | null = DEFAULT_COMPANY_ID) {
    await this.validator.validateCreate(dto, companyId);

    const { rootType, reportType } = this.treeBuilder.deriveRootAndReportType(
      dto.accountType,
      dto.parentId ? await this.accountRepo.findById(dto.parentId) : null,
    );

    const account = await this.prisma.account.create({
      data: {
        code: dto.code,
        name: dto.name,
        nameEn: dto.nameEn,
        rootType: dto.rootType ?? rootType,
        reportType: dto.reportType ?? reportType,
        accountType: dto.accountType,
        parentId: dto.parentId ?? null,
        isGroup: dto.isGroup ?? false,
        balanceMustBe: dto.balanceMustBe ?? null,
        accountCurrency: dto.accountCurrency ?? null,
        companyId,
      },
    });

    await this.treeBuilder.rebuildNestedSet(companyId);
    return this.getAccountById(account.id);
  }

  async updateAccount(id: number, dto: UpdateAccountDto, companyId: number | null = DEFAULT_COMPANY_ID) {
    await this.validator.validateUpdate(id, dto, companyId);

    return this.prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.nameEn !== undefined) updateData.nameEn = dto.nameEn;
      if (dto.accountType !== undefined) updateData.accountType = dto.accountType;
      if (dto.parentId !== undefined) updateData.parentId = dto.parentId;
      if (dto.isGroup !== undefined) updateData.isGroup = dto.isGroup;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
      if (dto.freezeAccount !== undefined) updateData.freezeAccount = dto.freezeAccount;
      if (dto.balanceMustBe !== undefined) updateData.balanceMustBe = dto.balanceMustBe;
      if (dto.accountCurrency !== undefined) updateData.accountCurrency = dto.accountCurrency;

      if (dto.accountType !== undefined || dto.parentId !== undefined) {
        const current = await this.accountRepo.findById(id);
        const parentId = dto.parentId !== undefined ? dto.parentId : current?.parentId ?? null;
        const parent = parentId ? await this.accountRepo.findById(parentId) : null;
        const accountType = dto.accountType ?? current?.accountType ?? 'Other';
        const { rootType, reportType } = this.treeBuilder.deriveRootAndReportType(accountType, parent);
        updateData.rootType = rootType;
        updateData.reportType = reportType;
      }

      await tx.account.update({ where: { id }, data: updateData });
      await this.treeBuilder.rebuildNestedSet(companyId);
      return this.getAccountById(id);
    });
  }

  async deleteAccount(id: number) {
    await this.validator.validateForDeletion(id);
    return this.prisma.account.delete({ where: { id } });
  }

  async rebuildTree(companyId: number | null = DEFAULT_COMPANY_ID) {
    await this.treeBuilder.rebuildNestedSet(companyId);
  }

  async getAccountIdByCode(code: string, companyId: number | null = DEFAULT_COMPANY_ID): Promise<number | null> {
    const account = await this.accountRepo.findByCodeAndCompany(code, companyId);
    return account?.id ?? null;
  }
}
