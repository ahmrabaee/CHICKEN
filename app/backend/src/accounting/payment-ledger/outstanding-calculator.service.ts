import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaymentLedgerEntry } from '@prisma/client';

/**
 * Blueprint 04: Outstanding Calculator Service
 * Derives Outstanding from PLE (not stored amountPaid)
 * Outstanding = Invoice Total - Sum(Allocated Payments) - Sum(Credit Notes)
 */
@Injectable()
export class OutstandingCalculatorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get outstanding amount for a sale
   * Invoice PLE (positive) - Payment PLEs (negative, against this sale)
   */
  async getSaleOutstanding(saleId: number, tx?: any): Promise<number> {
    const db = tx ?? this.prisma;
    const entries = await db.paymentLedgerEntry.findMany({
      where: {
        delinked: false,
        OR: [
          { voucherType: 'sale', voucherId: saleId },
          { againstVoucherType: 'sale', againstVoucherId: saleId },
        ],
      },
    });

    const invoiceTotal = entries
      .filter((e: PaymentLedgerEntry) => e.voucherType === 'sale' && e.voucherId === saleId && !e.againstVoucherId)
      .reduce((s: number, e: PaymentLedgerEntry) => s + e.amount, 0);

    const allocated = entries
      .filter((e: PaymentLedgerEntry) => e.againstVoucherType === 'sale' && e.againstVoucherId === saleId)
      .reduce((s: number, e: PaymentLedgerEntry) => s + Math.abs(e.amount), 0);

    return Math.max(0, invoiceTotal - allocated);
  }

  /**
   * Get outstanding amount for a purchase
   */
  async getPurchaseOutstanding(purchaseId: number, tx?: any): Promise<number> {
    const db = tx ?? this.prisma;
    const entries = await db.paymentLedgerEntry.findMany({
      where: {
        delinked: false,
        OR: [
          { voucherType: 'purchase', voucherId: purchaseId },
          { againstVoucherType: 'purchase', againstVoucherId: purchaseId },
        ],
      },
    });

    const invoiceTotal = entries
      .filter((e: PaymentLedgerEntry) => e.voucherType === 'purchase' && e.voucherId === purchaseId && !e.againstVoucherId)
      .reduce((s: number, e: PaymentLedgerEntry) => s + Math.abs(e.amount), 0);

    const allocated = entries
      .filter((e: PaymentLedgerEntry) => e.againstVoucherType === 'purchase' && e.againstVoucherId === purchaseId)
      .reduce((s: number, e: PaymentLedgerEntry) => s + Math.abs(e.amount), 0);

    return Math.max(0, invoiceTotal - allocated);
  }

  /**
   * Get outstanding for any voucher type
   */
  async getOutstanding(voucherType: string, voucherId: number, tx?: any): Promise<number> {
    if (voucherType === 'sale') return this.getSaleOutstanding(voucherId, tx);
    if (voucherType === 'purchase') return this.getPurchaseOutstanding(voucherId, tx);
    return 0;
  }

  /**
   * Get total party outstanding (customer or supplier)
   */
  async getPartyOutstanding(
    partyType: 'customer' | 'supplier',
    partyId: number,
    tx?: any,
  ): Promise<number> {
    const db = tx ?? this.prisma;
    const entries = await db.paymentLedgerEntry.findMany({
      where: { partyType, partyId, delinked: false },
    });

    const accountType = partyType === 'customer' ? 'receivable' : 'payable';
    const relevant = entries.filter((e: PaymentLedgerEntry) => e.accountType === accountType);

    const invoices = relevant.filter((e: PaymentLedgerEntry) => !e.againstVoucherId);
    const payments = relevant.filter((e: PaymentLedgerEntry) => e.againstVoucherId);

    const totalInvoiced = invoices.reduce((s: number, e: PaymentLedgerEntry) => s + e.amount, 0);
    const totalAllocated = payments.reduce((s: number, e: PaymentLedgerEntry) => s + Math.abs(e.amount), 0);

    if (accountType === 'receivable') {
      return Math.max(0, totalInvoiced - totalAllocated);
    }
    return Math.max(0, Math.abs(totalInvoiced) - totalAllocated);
  }
}
