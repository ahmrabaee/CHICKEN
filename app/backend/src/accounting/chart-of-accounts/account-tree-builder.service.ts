import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Account } from '@prisma/client';

interface TreeAccount extends Account {
  children: TreeAccount[];
}

@Injectable()
export class AccountTreeBuilderService {
  constructor(private prisma: PrismaService) { }

  async rebuildNestedSet(companyId: number | null, tx?: any): Promise<void> {
    const client = tx ?? this.prisma;
    const accounts = await client.account.findMany({
      where: { companyId },
      orderBy: [{ parentId: 'asc' }, { code: 'asc' }],
    });

    const tree = this.buildTree(accounts, null);
    let counter = 0;

    const assignLftRgt = (node: TreeAccount) => {
      node.lft = ++counter;
      for (const child of node.children) {
        assignLftRgt(child);
      }
      node.rgt = ++counter;
    };

    for (const root of tree) {
      assignLftRgt(root);
    }

    const flat = this.flattenTree(tree);

    // When inside an outer transaction, execute updates sequentially
    // Otherwise, batch them in a $transaction
    if (tx) {
      for (const a of flat) {
        await tx.account.update({
          where: { id: a.id },
          data: { lft: a.lft, rgt: a.rgt },
        });
      }
    } else {
      await this.prisma.$transaction(
        flat.map((a) =>
          this.prisma.account.update({
            where: { id: a.id },
            data: { lft: a.lft, rgt: a.rgt },
          }),
        ),
      );
    }
  }

  deriveRootAndReportType(
    accountType: string,
    parentAccount?: Account | null,
  ): { rootType: string; reportType: string } {
    const rootTypeMap: Record<string, string> = {
      asset: 'Asset',
      liability: 'Liability',
      equity: 'Equity',
      revenue: 'Income',
      expense: 'Expense',
      Bank: 'Asset',
      Cash: 'Asset',
      Receivable: 'Asset',
      Stock: 'Asset',
      'Fixed Asset': 'Asset',
      Payable: 'Liability',
      Tax: 'Liability',
      'Cost of Goods Sold': 'Expense',
      'Expense Account': 'Expense',
      'Income Account': 'Income',
    };
    const rootType = rootTypeMap[accountType] ?? parentAccount?.rootType ?? 'Asset';
    const reportType = ['Asset', 'Liability', 'Equity'].includes(rootType) ? 'Balance Sheet' : 'Profit and Loss';
    return { rootType, reportType };
  }

  private buildTree(accounts: Account[], parentId: number | null): TreeAccount[] {
    return accounts
      .filter((a) => a.parentId === parentId)
      .map((a) => ({
        ...a,
        children: this.buildTree(accounts, a.id),
      }));
  }

  private flattenTree(tree: TreeAccount[]): Array<{ id: number; lft: number; rgt: number }> {
    const result: Array<{ id: number; lft: number; rgt: number }> = [];
    for (const node of tree) {
      result.push({ id: node.id, lft: node.lft, rgt: node.rgt });
      result.push(...this.flattenTree(node.children));
    }
    return result;
  }
}
