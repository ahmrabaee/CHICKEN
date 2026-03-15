import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCOUNT_CODES } from '../accounting.service';
import type { CreatePLEInput } from './payment-ledger.types';

/**
 * Blueprint 04: Payment Ledger Service
 * Creates PLE entries for invoices and payments (Subledger for Receivables/Payables)
 */
@Injectable()
export class PaymentLedgerService {
  constructor(private prisma: PrismaService) { }

  private async getAccountIdByCode(code: string, tx?: any, companyId: number | null = 1): Promise<number> {
    const db = tx ?? this.prisma;
    const acc = await db.account.findFirst({ where: { code, companyId } });
    if (!acc) throw new Error(`Account ${code} not found`);
    return acc.id;
  }

  /**
   * Create a Payment Ledger Entry
   */
  async createPLE(input: CreatePLEInput, tx?: any): Promise<void> {
    const db = tx ?? this.prisma;
    await db.paymentLedgerEntry.create({
      data: {
        partyType: input.partyType,
        partyId: input.partyId,
        accountType: input.accountType,
        accountId: input.accountId,
        voucherType: input.voucherType,
        voucherId: input.voucherId,
        againstVoucherType: input.againstVoucherType ?? null,
        againstVoucherId: input.againstVoucherId ?? null,
        amount: input.amount,
        postingDate: input.postingDate,
        dueDate: input.dueDate ?? null,
        remarks: input.remarks ?? null,
      },
    });
  }

  /**
   * Create PLE for a Sale (invoice - receivable)
   * Called when sale is created with customer and totalAmount > 0
   */
  async createPLEForSale(
    tx: any,
    saleId: number,
    customerId: number,
    totalAmount: number,
    postingDate: Date,
    dueDate?: Date | null,
  ): Promise<void> {
    const accountId = await this.getAccountIdByCode(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, tx);
    await this.createPLE(
      {
        partyType: 'customer',
        partyId: customerId,
        accountType: 'receivable',
        accountId,
        voucherType: 'sale',
        voucherId: saleId,
        amount: totalAmount,
        postingDate,
        dueDate,
        remarks: `Sale #${saleId}`,
      },
      tx,
    );
  }

  /**
   * Create PLE for a Payment against Sale (decreases receivable)
   */
  async createPLEForPaymentAgainstSale(
    tx: any,
    paymentId: number,
    saleId: number,
    customerId: number,
    amount: number,
    postingDate: Date,
  ): Promise<void> {
    const accountId = await this.getAccountIdByCode(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, tx);
    await this.createPLE(
      {
        partyType: 'customer',
        partyId: customerId,
        accountType: 'receivable',
        accountId,
        voucherType: 'payment',
        voucherId: paymentId,
        againstVoucherType: 'sale',
        againstVoucherId: saleId,
        amount: -amount, // Negative: payment reduces receivable
        postingDate,
        remarks: `Payment against Sale #${saleId}`,
      },
      tx,
    );
  }

  /**
   * Create PLE for a Purchase (invoice - payable)
   */
  async createPLEForPurchase(
    tx: any,
    purchaseId: number,
    supplierId: number,
    totalAmount: number,
    postingDate: Date,
    dueDate?: Date | null,
  ): Promise<void> {
    const accountId = await this.getAccountIdByCode(ACCOUNT_CODES.ACCOUNTS_PAYABLE, tx);
    await this.createPLE(
      {
        partyType: 'supplier',
        partyId: supplierId,
        accountType: 'payable',
        accountId,
        voucherType: 'purchase',
        voucherId: purchaseId,
        amount: -totalAmount, // Payable: negative for increase (we owe)
        postingDate,
        dueDate,
        remarks: `Purchase #${purchaseId}`,
      },
      tx,
    );
  }

  /**
   * Create PLE for a Payment against Purchase (decreases payable)
   */
  async createPLEForPaymentAgainstPurchase(
    tx: any,
    paymentId: number,
    purchaseId: number,
    supplierId: number,
    amount: number,
    postingDate: Date,
  ): Promise<void> {
    const accountId = await this.getAccountIdByCode(ACCOUNT_CODES.ACCOUNTS_PAYABLE, tx);
    await this.createPLE(
      {
        partyType: 'supplier',
        partyId: supplierId,
        accountType: 'payable',
        accountId,
        voucherType: 'payment',
        voucherId: paymentId,
        againstVoucherType: 'purchase',
        againstVoucherId: purchaseId,
        amount, // Positive: payment reduces payable (we paid)
        postingDate,
        remarks: `Payment against Purchase #${purchaseId}`,
      },
      tx,
    );
  }

  /**
   * Delete PLE entries for a voucher (e.g. on cancel/void)
   */
  async deletePLEForVoucher(voucherType: string, voucherId: number, tx?: any): Promise<void> {
    const db = tx ?? this.prisma;
    await db.paymentLedgerEntry.deleteMany({
      where: { voucherType, voucherId },
    });
  }

  /**
   * Mark PLE entries as delinked instead of delete (for audit)
   */
  async delinkPLEForVoucher(voucherType: string, voucherId: number, tx?: any): Promise<void> {
    const db = tx ?? this.prisma;
    await db.paymentLedgerEntry.updateMany({
      where: { voucherType, voucherId },
      data: { delinked: true },
    });
  }

  /**
   * Get Statement of Account for a party
   * Uses PaymentLedgerEntry (PLE) as primary source.
   * For customers: falls back to Sale+Payment when PLE is empty (e.g. seeded/legacy data).
   */
  async getStatement(
    partyType: string,
    partyId: number,
    startDate: Date,
    endDate: Date,
    tx?: any,
  ) {
    const db = tx ?? this.prisma;

    // 1. Try PLE (Payment Ledger Entry) - primary source
    const openingAgg = await db.paymentLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        partyType,
        partyId,
        postingDate: { lt: startDate },
        delinked: false,
      },
    });
    const pleOpeningBalance = openingAgg._sum.amount || 0;

    const entries = await db.paymentLedgerEntry.findMany({
      where: {
        partyType,
        partyId,
        postingDate: { gte: startDate, lte: endDate },
        delinked: false,
      },
      orderBy: { postingDate: 'asc' },
    });

    // 2. If PLE has data, use it
    if (entries.length > 0) {
      let runningBalance = pleOpeningBalance;
      let totalDebits = 0;
      let totalCredits = 0;

      const transactions = entries.map((entry: any) => {
        const debit = entry.amount > 0 ? entry.amount : 0;
        const credit = entry.amount < 0 ? Math.abs(entry.amount) : 0;

        runningBalance += entry.amount;
        totalDebits += debit;
        totalCredits += credit;

        return {
          id: entry.id,
          date: entry.postingDate,
          type: entry.voucherType,
          reference: `${entry.voucherType} #${entry.voucherId}`,
          debit,
          credit,
          balance: runningBalance,
          notes: entry.remarks,
        };
      });

      return {
        openingBalance: pleOpeningBalance,
        transactions,
        closingBalance: runningBalance,
        totalDebits,
        totalCredits,
      };
    }

    // 3. Fallback for customers: build from Sale + Payment when PLE is empty
    if (partyType === 'customer') {
      return this.getStatementForCustomerFromSales(db, partyId, startDate, endDate);
    }

    // 4. No data: return empty statement
    return {
      openingBalance: pleOpeningBalance,
      transactions: [],
      closingBalance: pleOpeningBalance,
      totalDebits: 0,
      totalCredits: 0,
    };
  }

  /**
   * Build customer statement from Sale + Payment tables (fallback when PLE empty)
   * Covers seeded/legacy data that bypassed PLE creation.
   * Matches sales by customerId OR by customerName+customerPhone when customerId is null.
   */
  private async getStatementForCustomerFromSales(
    db: any,
    customerId: number,
    startDate: Date,
    endDate: Date,
  ) {
    type StmtRow = { date: Date; type: string; ref: string; amount: number; remarks?: string };

    const customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { name: true, phone: true, phone2: true },
    });
    if (!customer) {
      return {
        openingBalance: 0,
        transactions: [],
        closingBalance: 0,
        totalDebits: 0,
        totalCredits: 0,
      };
    }

    // Build sales OR: by customerId OR by name+phone (for walk-in sales without customerId)
    const phones = [customer.phone, customer.phone2].filter(Boolean) as string[];
    const salesOr: any[] = [{ customerId, isVoided: false, docstatus: 1 }];
    if (customer.name && phones.length > 0) {
      salesOr.push({
        customerId: null,
        customerName: customer.name,
        customerPhone: { in: phones },
        isVoided: false,
        docstatus: 1,
      });
    }
    const salesBaseWhere = { OR: salesOr };

    // Opening: sales before start - payments before start
    const salesBefore = await db.sale.aggregate({
      _sum: { totalAmount: true },
      where: {
        ...salesBaseWhere,
        saleDate: { lt: startDate },
      },
    });
    const paymentsBefore = await db.payment.aggregate({
      _sum: { amount: true },
      where: {
        partyType: 'customer',
        partyId: customerId,
        isVoided: false,
        docstatus: 1,
        paymentDate: { lt: startDate },
      },
    });

    const openingBalance =
      (salesBefore._sum?.totalAmount ?? 0) - (paymentsBefore._sum?.amount ?? 0);

    // Sales in range: debit (increase receivable)
    const sales = await db.sale.findMany({
      where: {
        ...salesBaseWhere,
        saleDate: { gte: startDate, lte: endDate },
      },
      orderBy: { saleDate: 'asc' },
    });

    // Payments in range: credit (decrease receivable)
    const payments = await db.payment.findMany({
      where: {
        partyType: 'customer',
        partyId: customerId,
        isVoided: false,
        docstatus: 1,
        paymentDate: { gte: startDate, lte: endDate },
      },
      orderBy: { paymentDate: 'asc' },
    });

    const rows: StmtRow[] = [];

    for (const s of sales) {
      const amt = s.grandTotal ?? s.totalAmount ?? 0;
      rows.push({
        date: s.saleDate,
        type: 'sale',
        ref: `sale #${s.id}`,
        amount: amt,
        remarks: s.saleNumber,
      });
    }

    for (const p of payments) {
      const amt = p.amount ?? 0;
      rows.push({
        date: p.paymentDate,
        type: 'payment',
        ref: `payment #${p.id}`,
        amount: -amt,
        remarks:
          p.paymentNumber ??
          (p.referenceType === 'sale' && p.referenceId
            ? `سند دفع لفاتورة #${p.referenceId}`
            : undefined),
      });
    }

    rows.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Debug: when no transactions, log to help diagnose
    if (rows.length === 0) {
      const anyByCustomerId = await db.sale.count({ where: { customerId, isVoided: false } });
      const anyByNamePhone =
        customer.name && phones.length
          ? await db.sale.count({
              where: { customerId: null, customerName: customer.name, customerPhone: { in: phones }, isVoided: false },
            })
          : 0;
      // eslint-disable-next-line no-console
      console.log(
        `[Statement] customerId=${customerId} (${customer.name}) period=${startDate.toISOString().split('T')[0]}/${endDate.toISOString().split('T')[0]}`,
        `| salesInRange=0 paymentsInRange=${payments.length} | salesByCustomerId=${anyByCustomerId} salesByNamePhone=${anyByNamePhone}`,
      );
    }

    let runningBalance = openingBalance;
    let totalDebits = 0;
    let totalCredits = 0;

    const transactions = rows.map((r) => {
      const debit = r.amount > 0 ? r.amount : 0;
      const credit = r.amount < 0 ? Math.abs(r.amount) : 0;

      runningBalance += r.amount;
      totalDebits += debit;
      totalCredits += credit;

      return {
        id: 0,
        date: r.date,
        type: r.type,
        reference: r.ref,
        debit,
        credit,
        balance: runningBalance,
        notes: r.remarks,
      };
    });

    return {
      openingBalance,
      transactions,
      closingBalance: runningBalance,
      totalDebits,
      totalCredits,
    };
  }
}
