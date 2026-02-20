import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PreventGroupPostingGuard {
  constructor(private prisma: PrismaService) { }

  async validateAccountsForPosting(accountIds: number[]): Promise<void> {
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, code: true, name: true, isGroup: true, isActive: true, freezeAccount: true },
    });

    const groupAccounts = accounts.filter((a) => a.isGroup);
    if (groupAccounts.length > 0) {
      throw new BadRequestException({
        code: 'POSTING_TO_GROUP_ACCOUNT',
        message: `Cannot post to group accounts: ${groupAccounts.map((a) => a.code).join(', ')}`,
        messageAr: `لا يمكن القيد على حسابات المجموعة: ${groupAccounts.map((a) => a.name).join('، ')}`,
      });
    }

    const inactiveAccounts = accounts.filter((a) => !a.isActive);
    if (inactiveAccounts.length > 0) {
      throw new BadRequestException({
        code: 'POSTING_TO_DISABLED_ACCOUNT',
        message: `Cannot post to disabled accounts: ${inactiveAccounts.map((a) => a.code).join(', ')}`,
        messageAr: `لا يمكن القيد على حسابات معطلة: ${inactiveAccounts.map((a) => a.name).join('، ')}`,
      });
    }

    const frozenAccounts = accounts.filter((a) => a.freezeAccount);
    if (frozenAccounts.length > 0) {
      throw new BadRequestException({
        code: 'POSTING_TO_FROZEN_ACCOUNT',
        message: `Cannot post to frozen accounts: ${frozenAccounts.map((a) => a.code).join(', ')}`,
        messageAr: `لا يمكن القيد على حسابات مجمدة: ${frozenAccounts.map((a) => a.name).join('، ')}`,
      });
    }
  }

  /**
   * Blueprint 01: Enforce balanceMustBe constraint.
   * If an account has balanceMustBe='Debit', it cannot receive a credit-only posting (and vice versa).
   */
  async validateAccountPostingSides(
    lines: Array<{ accountId: number; debitAmount?: number; creditAmount?: number }>,
  ): Promise<void> {
    const accountIds = [...new Set(lines.map((l) => l.accountId))];
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, code: true, name: true, balanceMustBe: true },
    });

    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    for (const line of lines) {
      const account = accountMap.get(line.accountId);
      if (!account?.balanceMustBe) continue;

      const debit = line.debitAmount ?? 0;
      const credit = line.creditAmount ?? 0;

      if (account.balanceMustBe === 'Debit' && credit > 0 && debit === 0) {
        throw new BadRequestException({
          code: 'BALANCE_MUST_BE_DEBIT',
          message: `Account ${account.code} only accepts debit postings`,
          messageAr: `الحساب ${account.name} يقبل القيد المدين فقط`,
        });
      }

      if (account.balanceMustBe === 'Credit' && debit > 0 && credit === 0) {
        throw new BadRequestException({
          code: 'BALANCE_MUST_BE_CREDIT',
          message: `Account ${account.code} only accepts credit postings`,
          messageAr: `الحساب ${account.name} يقبل القيد الدائن فقط`,
        });
      }
    }
  }
}
