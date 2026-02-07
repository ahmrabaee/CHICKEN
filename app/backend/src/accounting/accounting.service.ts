import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createPaginatedResult, PaginationQueryDto } from '../common';

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  // Chart of Accounts
  async getAccounts() {
    return this.prisma.account.findMany({
      where: { isActive: true },
      include: { parentAccount: true, childAccounts: true },
      orderBy: { code: 'asc' },
    });
  }

  async getAccountByCode(code: string) {
    const account = await this.prisma.account.findUnique({
      where: { code },
      include: { parentAccount: true, childAccounts: true },
    });

    if (!account) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Account not found',
        messageAr: 'الحساب غير موجود',
      });
    }

    return account;
  }

  async createAccount(dto: any) {
    return this.prisma.account.create({
      data: {
        code: dto.code,
        name: dto.name,
        nameEn: dto.nameEn,
        accountType: dto.accountType,
        parentAccountCode: dto.parentAccountCode,
        isActive: true,
      },
    });
  }

  async updateAccount(code: string, dto: any) {
    await this.getAccountByCode(code);

    return this.prisma.account.update({
      where: { code },
      data: {
        name: dto.name,
        nameEn: dto.nameEn,
        parentAccountCode: dto.parentAccountCode,
        isActive: dto.isActive,
      },
    });
  }

  // Journal Entries
  async getJournalEntries(pagination: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const [entries, totalItems] = await Promise.all([
      this.prisma.journalEntry.findMany({
        skip,
        take: pageSize,
        include: { lines: { include: { account: true } }, createdBy: true },
        orderBy: { entryDate: 'desc' },
      }),
      this.prisma.journalEntry.count(),
    ]);

    return createPaginatedResult(entries, page, pageSize, totalItems);
  }

  async getJournalEntryById(id: number) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { account: true } }, createdBy: true },
    });

    if (!entry) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Journal entry not found',
        messageAr: 'القيد غير موجود',
      });
    }

    return entry;
  }

  async createJournalEntry(dto: any, userId: number) {
    // Validate debits equal credits
    const totalDebit = dto.lines.reduce((sum: number, l: any) => sum + (l.debitAmount ?? 0), 0);
    const totalCredit = dto.lines.reduce((sum: number, l: any) => sum + (l.creditAmount ?? 0), 0);

    if (totalDebit !== totalCredit) {
      throw new BadRequestException({
        code: 'UNBALANCED_ENTRY',
        message: 'Debits must equal credits',
        messageAr: 'يجب أن يتساوى المدين مع الدائن',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const entryNumber = await this.generateEntryNumber(tx);

      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          entryDate: dto.entryDate ? new Date(dto.entryDate) : new Date(),
          description: dto.description,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          branchId: dto.branchId,
          createdById: userId,
        },
      });

      for (let i = 0; i < dto.lines.length; i++) {
        const line = dto.lines[i];
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: entry.id,
            lineNumber: i + 1,
            accountCode: line.accountCode,
            debitAmount: line.debitAmount ?? 0,
            creditAmount: line.creditAmount ?? 0,
            description: line.description,
          },
        });
      }

      return this.getJournalEntryById(entry.id);
    });
  }

  async postJournalEntry(id: number) {
    const entry = await this.getJournalEntryById(id);

    if (entry.isPosted) {
      throw new BadRequestException({
        code: 'ALREADY_POSTED',
        message: 'Entry is already posted',
        messageAr: 'القيد مرحل بالفعل',
      });
    }

    return this.prisma.journalEntry.update({
      where: { id },
      data: { isPosted: true },
    });
  }

  async reverseJournalEntry(id: number, userId: number) {
    const entry = await this.getJournalEntryById(id);

    if (entry.isReversed) {
      throw new BadRequestException({
        code: 'ALREADY_REVERSED',
        message: 'Entry is already reversed',
        messageAr: 'القيد معكوس بالفعل',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Create reversal entry
      const reversal = await this.createJournalEntry({
        description: `عكس: ${entry.description}`,
        sourceType: 'adjustment',
        lines: entry.lines.map((l) => ({
          accountCode: l.accountCode,
          debitAmount: l.creditAmount, // Swap
          creditAmount: l.debitAmount,
        })),
      }, userId);

      // Mark original as reversed
      await tx.journalEntry.update({
        where: { id },
        data: { isReversed: true, reversedByEntryId: reversal.id },
      });

      return reversal;
    });
  }

  // Trial Balance
  async getTrialBalance(asOfDate?: string) {
    const dateFilter = asOfDate ? { lte: new Date(asOfDate) } : undefined;

    const grouped = await this.prisma.journalEntryLine.groupBy({
      by: ['accountCode'],
      where: dateFilter ? { journalEntry: { entryDate: dateFilter, isPosted: true } } : { journalEntry: { isPosted: true } },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const accountCodes = grouped.map((g) => g.accountCode);
    const accounts = await this.prisma.account.findMany({
      where: { code: { in: accountCodes } },
    });

    const accountMap = new Map(accounts.map((a) => [a.code, a]));

    return grouped.map((b) => {
      const account = accountMap.get(b.accountCode);
      const debit = b._sum?.debitAmount ?? 0;
      const credit = b._sum?.creditAmount ?? 0;
      return {
        accountCode: b.accountCode,
        accountName: account?.name ?? 'Unknown',
        accountType: account?.accountType ?? 'unknown',
        debit,
        credit,
        balance: debit - credit,
      };
    });
  }

  // Account Ledger
  async getAccountLedger(accountCode: string, startDate?: string, endDate?: string) {
    await this.getAccountByCode(accountCode);

    const where: any = { accountCode };
    if (startDate || endDate) {
      where.journalEntry = {};
      if (startDate) where.journalEntry.entryDate = { gte: new Date(startDate) };
      if (endDate) where.journalEntry.entryDate = { ...where.journalEntry.entryDate, lte: new Date(endDate) };
    }

    const lines = await this.prisma.journalEntryLine.findMany({
      where,
      include: { journalEntry: true },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });

    let runningBalance = 0;
    return lines.map((l) => {
      runningBalance += l.debitAmount - l.creditAmount;
      return {
        date: l.journalEntry.entryDate,
        entryNumber: l.journalEntry.entryNumber,
        description: l.description ?? l.journalEntry.description,
        debit: l.debitAmount,
        credit: l.creditAmount,
        balance: runningBalance,
      };
    });
  }

  private async generateEntryNumber(tx: any): Promise<string> {
    const count = await tx.journalEntry.count();
    return `JE-${(count + 1).toString().padStart(6, '0')}`;
  }
}
