import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PreventGroupPostingGuard {
  constructor(private prisma: PrismaService) {}

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
}
