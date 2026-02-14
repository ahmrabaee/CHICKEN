import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VATReport } from './types/tax.types';

/**
 * Blueprint 05: VAT Report - built from GL, not from Sale/Purchase
 */
@Injectable()
export class VatReportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate VAT report from journal entry lines
   * Output VAT: credits to VAT Payable (sales)
   * Input VAT: debits to VAT Receivable (purchases)
   */
  async generateVATReport(
    startDate: Date,
    endDate: Date,
    companyId?: number,
  ): Promise<VATReport> {
    const accounts = await this.prisma.account.findMany({
      where: {
        companyId: companyId ?? undefined,
        accountType: { in: ['Tax', 'Tax Receivable'] },
      },
    });
    const accountIds = accounts.map((a) => a.id);
    const codeMap = new Map(accounts.map((a) => [a.id, { code: a.code, name: a.name }]));

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId: { in: accountIds },
        journalEntry: {
          entryDate: { gte: startDate, lte: endDate },
          isReversed: false,
        },
      },
      include: { journalEntry: true },
    });

    const byAccount: Record<number, { output: number; input: number }> = {};
    for (const a of accountIds) {
      byAccount[a] = { output: 0, input: 0 };
    }

    for (const line of lines) {
      const acc = byAccount[line.accountId];
      if (!acc) continue;
      const debit = line.debitAmount ?? 0;
      const credit = line.creditAmount ?? 0;
      const account = accounts.find((a) => a.id === line.accountId);
      // VAT Payable (Tax): Credit = output VAT from sales, Debit = reversal
      // VAT Receivable (Tax Receivable): Debit = input VAT from purchases, Credit = reversal
      if (account?.accountType === 'Tax') {
        acc.output += credit;
        acc.input += debit;
      } else if (account?.accountType === 'Tax Receivable') {
        acc.input += debit;
        acc.output += credit;
      }
    }

    const byAccountList = Object.entries(byAccount).map(([idStr, v]) => {
      const id = parseInt(idStr, 10);
      const info = codeMap.get(id) ?? { code: '', name: '' };
      return { accountId: id, accountCode: info.code, accountName: info.name, output: v.output, input: v.input };
    });

    const outputVat = byAccountList.reduce((s, a) => s + a.output, 0);
    const inputVat = byAccountList.reduce((s, a) => s + a.input, 0);

    // Simple byRate: group by account (each tax account typically has one rate)
    const byRateMap = new Map<number, { output: number; input: number }>();
    for (const a of byAccountList) {
      const rate = 1500; // default 15% - we'd need rate from tax breakdown; for now use placeholder
      const cur = byRateMap.get(rate) ?? { output: 0, input: 0 };
      cur.output += a.output;
      cur.input += a.input;
      byRateMap.set(rate, cur);
    }
    const byRate = Array.from(byRateMap.entries()).map(([rate, v]) => ({ rate, output: v.output, input: v.input }));

    return {
      outputVat,
      inputVat,
      netVatPayable: outputVat - inputVat,
      byAccount: byAccountList,
      byRate,
    };
  }
}
