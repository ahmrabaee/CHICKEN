import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChartOfAccountsService } from '../accounting/chart-of-accounts/chart-of-accounts.service';

const DEFAULT_COMPANY_ID = 1;
const BANK_PARENT_CODE = '1112'; // النقد في البنك

@Injectable()
export class BankAccountsService {
  constructor(
    private prisma: PrismaService,
    private chartOfAccountsService: ChartOfAccountsService,
  ) {}

  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    return this.prisma.bankAccount.findMany({
      where: { ...where, companyId: DEFAULT_COMPANY_ID },
      include: { account: { select: { id: true, code: true, name: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async findById(id: number) {
    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { id, companyId: DEFAULT_COMPANY_ID },
      include: { account: true },
    });
    if (!bankAccount) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Bank account not found',
        messageAr: 'الحساب البنكي غير موجود',
      });
    }
    return bankAccount;
  }

  async getDefault() {
    return this.prisma.bankAccount.findFirst({
      where: { isDefault: true, isActive: true, companyId: DEFAULT_COMPANY_ID },
      include: { account: { select: { id: true, code: true, name: true } } },
    });
  }

  private async generateCode() {
    const count = await this.prisma.bankAccount.count({ where: { companyId: DEFAULT_COMPANY_ID } });
    return `BANK-${String(count + 1).padStart(3, '0')}`;
  }

  async create(dto: { name: string; nameEn?: string; accountId?: number; isDefault?: boolean }) {
    let accountId: number;

    if (dto.accountId && dto.accountId > 0) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.accountId, companyId: DEFAULT_COMPANY_ID },
      });
      if (!account) {
        throw new BadRequestException({
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Chart of accounts entry not found',
          messageAr: 'الحساب غير موجود في دليل الحسابات',
        });
      }
      accountId = dto.accountId;
    } else {
      // Auto-create account under 1112 (النقد في البنك)
      const parentAccount = await this.prisma.account.findFirst({
        where: { code: BANK_PARENT_CODE, companyId: DEFAULT_COMPANY_ID },
      });
      if (!parentAccount) {
        throw new BadRequestException({
          code: 'PARENT_ACCOUNT_NOT_FOUND',
          message: `Parent account ${BANK_PARENT_CODE} not found`,
          messageAr: 'حساب النقد في البنك (1112) غير موجود في دليل الحسابات',
        });
      }
      const parentId = parentAccount.id;

      // Ensure 1112 is a group (required for adding children); update if it was created as leaf in seed
      if (!parentAccount.isGroup) {
        await this.prisma.account.update({
          where: { id: parentId },
          data: { isGroup: true },
        });
      }

      const existingChildren = await this.prisma.account.findMany({
        where: { parentId },
        select: { code: true },
      });
      const suffixes = existingChildren
        .map((a) => {
          const m = a.code.match(new RegExp(`^${BANK_PARENT_CODE}-(\\d+)$`));
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => n > 0);
      const nextSuffix = suffixes.length === 0 ? 1 : Math.max(...suffixes) + 1;
      const newCode = `${BANK_PARENT_CODE}-${String(nextSuffix).padStart(3, '0')}`;
      const created = await this.chartOfAccountsService.createAccount(
        {
          code: newCode,
          name: dto.name,
          nameEn: dto.nameEn,
          accountType: 'Bank',
          parentId,
        },
        DEFAULT_COMPANY_ID,
      );
      accountId = created.id;
    }

    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { companyId: DEFAULT_COMPANY_ID },
        data: { isDefault: false },
      });
    }

    const code = await this.generateCode();
    return this.prisma.bankAccount.create({
      data: {
        code,
        name: dto.name,
        nameEn: dto.nameEn,
        accountId,
        companyId: DEFAULT_COMPANY_ID,
        isDefault: dto.isDefault ?? false,
      },
      include: { account: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: number, dto: { name?: string; nameEn?: string; accountId?: number; isActive?: boolean; isDefault?: boolean }) {
    const existing = await this.findById(id);

    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { companyId: DEFAULT_COMPANY_ID, id: { not: id } },
        data: { isDefault: false },
      });
    }

    if (dto.accountId != null) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.accountId, companyId: DEFAULT_COMPANY_ID },
      });
      if (!account) {
        throw new BadRequestException({
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Chart of accounts entry not found',
          messageAr: 'الحساب غير موجود في دليل الحسابات',
        });
      }
    }

    return this.prisma.bankAccount.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.accountId != null && { accountId: dto.accountId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
      include: { account: { select: { id: true, code: true, name: true } } },
    });
  }

  async delete(id: number) {
    await this.findById(id);

    const hasPayments = await this.prisma.payment.count({ where: { bankAccountId: id } });
    const hasExpenses = await this.prisma.expense.count({ where: { bankAccountId: id } });
    if (hasPayments > 0 || hasExpenses > 0) {
      throw new BadRequestException({
        code: 'BANK_ACCOUNT_IN_USE',
        message: 'Cannot delete bank account with existing transactions',
        messageAr: 'لا يمكن حذف الحساب البنكي لوجود معاملات مرتبطة به',
      });
    }

    return this.prisma.bankAccount.delete({ where: { id } });
  }
}
