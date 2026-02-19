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
   */
  async getStatement(
    partyType: string,
    partyId: number,
    startDate: Date,
    endDate: Date,
    tx?: any,
  ) {
    const db = tx ?? this.prisma;

    // 1. Calculate Opening Balance
    const openingAgg = await db.paymentLedgerEntry.aggregate({
      _sum: { amount: true },
      where: {
        partyType,
        partyId,
        postingDate: { lt: startDate },
        delinked: false,
      },
    });
    const openingBalance = openingAgg._sum.amount || 0;

    // 2. Fetch Transactions
    const entries = await db.paymentLedgerEntry.findMany({
      where: {
        partyType,
        partyId,
        postingDate: { gte: startDate, lte: endDate },
        delinked: false,
      },
      orderBy: { postingDate: 'asc' },
    });

    // 3. Process Transactions
    let runningBalance = openingBalance;
    let totalDebits = 0;
    let totalCredits = 0;

    const transactions = entries.map((entry: any) => {
      // Debit = Positive amount (Asset Increase / Liability Decrease)
      // Credit = Negative amount (Asset Decrease / Liability Increase)
      const debit = entry.amount > 0 ? entry.amount : 0;
      const credit = entry.amount < 0 ? Math.abs(entry.amount) : 0;

      runningBalance += entry.amount;
      totalDebits += debit;
      totalCredits += credit;

      return {
        id: entry.id,
        date: entry.postingDate,
        type: entry.voucherType, // e.g., 'sale', 'payment'
        reference: `${entry.voucherType} #${entry.voucherId}`,
        debit,
        credit,
        balance: runningBalance,
        notes: entry.remarks,
      };
    });

    return {
      openingBalance,
      transactions, // Map to DTO in controller/service
      closingBalance: runningBalance,
      totalDebits,
      totalCredits,
    };
  }
}
