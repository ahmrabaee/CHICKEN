import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Account } from '@prisma/client';

@Injectable()
export class AccountRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: number): Promise<Account | null> {
    return this.prisma.account.findUnique({
      where: { id },
      include: { parent: true, company: true },
    });
  }

  async findByCodeAndCompany(code: string, companyId: number | null): Promise<Account | null> {
    return this.prisma.account.findFirst({
      where: { code, companyId },
    });
  }

  async findDescendants(accountId: number): Promise<Account[]> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return [];
    return this.prisma.account.findMany({
      where: { lft: { gte: account.lft }, rgt: { lte: account.rgt }, companyId: account.companyId },
      orderBy: { lft: 'asc' },
    });
  }

  async findAncestors(accountId: number): Promise<Account[]> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return [];
    return this.prisma.account.findMany({
      where: { lft: { lte: account.lft }, rgt: { gte: account.rgt } },
      orderBy: { lft: 'asc' },
    });
  }

  async hasJournalEntries(accountId: number): Promise<boolean> {
    const count = await this.prisma.journalEntryLine.count({
      where: { accountId },
    });
    return count > 0;
  }

  async hasChildAccounts(accountId: number): Promise<boolean> {
    const count = await this.prisma.account.count({
      where: { parentId: accountId },
    });
    return count > 0;
  }
}
