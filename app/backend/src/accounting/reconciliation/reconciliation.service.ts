import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AllocationService, type AllocationInput } from './allocation.service';
import { OutstandingCalculatorService } from '../payment-ledger/outstanding-calculator.service';
import { PeriodLockGuard } from '../../common';

export interface OpenInvoice {
  voucherType: 'sale' | 'purchase';
  voucherId: number;
  voucherNumber: string;
  partyName: string;
  postingDate: Date;
  dueDate: Date | null;
  totalAmount: number;
  outstandingAmount: number;
}

export interface UnallocatedPayment {
  id: number;
  paymentNumber: string;
  paymentDate: Date;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  partyName: string;
}

export interface SuggestMatch {
  paymentId: number;
  paymentNumber: string;
  invoiceType: 'sale' | 'purchase';
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  score: number;
}

/**
 * Blueprint 04: Reconciliation Service
 * Open invoices, unallocated payments, suggest matches, apply allocations.
 */
@Injectable()
export class ReconciliationService {
  constructor(
    private prisma: PrismaService,
    private allocationService: AllocationService,
    private outstandingCalculator: OutstandingCalculatorService,
  ) {}

  async getOpenInvoices(
    partyType: 'customer' | 'supplier',
    partyId: number,
  ): Promise<OpenInvoice[]> {
    const isCustomer = partyType === 'customer';

    if (isCustomer) {
      const sales = await this.prisma.sale.findMany({
        where: { customerId: partyId, docstatus: 1, isVoided: false },
        include: { customer: true },
        orderBy: { saleDate: 'asc' },
      });

      const result: OpenInvoice[] = [];
      for (const s of sales) {
        const outstanding = await this.outstandingCalculator.getSaleOutstanding(s.id);
        if (outstanding > 0) {
          result.push({
            voucherType: 'sale',
            voucherId: s.id,
            voucherNumber: s.saleNumber,
            partyName: s.customerName ?? s.customer?.name ?? '',
            postingDate: s.saleDate,
            dueDate: s.dueDate,
            totalAmount: s.totalAmount,
            outstandingAmount: outstanding,
          });
        }
      }
      return result;
    } else {
      const purchases = await this.prisma.purchase.findMany({
        where: { supplierId: partyId, docstatus: 1 },
        include: { supplier: true },
        orderBy: { purchaseDate: 'asc' },
      });

      const result: OpenInvoice[] = [];
      for (const p of purchases) {
        const outstanding = await this.outstandingCalculator.getPurchaseOutstanding(p.id);
        if (outstanding > 0) {
          result.push({
            voucherType: 'purchase',
            voucherId: p.id,
            voucherNumber: p.purchaseNumber,
            partyName: p.supplierName ?? '',
            postingDate: p.purchaseDate,
            dueDate: p.dueDate,
            totalAmount: p.totalAmount,
            outstandingAmount: outstanding,
          });
        }
      }
      return result;
    }
  }

  /**
   * Unallocated = payment.amount - sum(PLE against invoices for this payment)
   * Uses PLE as source of truth (PaymentAllocation may not exist for legacy 1:1 payments)
   */
  async getUnallocatedPayments(
    partyType: 'customer' | 'supplier',
    partyId: number,
  ): Promise<UnallocatedPayment[]> {
    const payments = await this.prisma.payment.findMany({
      where: {
        partyType,
        partyId,
        isVoided: false,
        docstatus: 1,
      },
      orderBy: { paymentDate: 'asc' },
    });

    const pleForPayments = await this.prisma.paymentLedgerEntry.findMany({
      where: {
        voucherType: 'payment',
        voucherId: { in: payments.map((p) => p.id) },
        againstVoucherId: { not: null },
        delinked: false,
      },
    });

    const allocatedByPayment = new Map<number, number>();
    for (const ple of pleForPayments) {
      const current = allocatedByPayment.get(ple.voucherId) ?? 0;
      allocatedByPayment.set(ple.voucherId, current + Math.abs(ple.amount));
    }

    const result: UnallocatedPayment[] = [];
    for (const p of payments) {
      const allocated = allocatedByPayment.get(p.id) ?? 0;
      const unallocated = p.amount - allocated;
      if (unallocated > 0) {
        result.push({
          id: p.id,
          paymentNumber: p.paymentNumber,
          paymentDate: p.paymentDate,
          amount: p.amount,
          allocatedAmount: allocated,
          unallocatedAmount: unallocated,
          partyName: p.partyName ?? '',
        });
      }
    }
    return result;
  }

  /**
   * Suggest matches: for unallocated payments and open invoices, suggest by date/amount.
   */
  async suggest(partyType: 'customer' | 'supplier', partyId: number): Promise<SuggestMatch[]> {
    const [invoices, payments] = await Promise.all([
      this.getOpenInvoices(partyType, partyId),
      this.getUnallocatedPayments(partyType, partyId),
    ]);

    const matches: SuggestMatch[] = [];
    const usedPayment = new Map<number, number>();
    const usedInvoice = new Map<string, number>();

    for (const inv of invoices) {
      const key = `${inv.voucherType}-${inv.voucherId}`;
      let invRemaining = inv.outstandingAmount;

      for (const pay of payments) {
        const payRemaining = pay.unallocatedAmount - (usedPayment.get(pay.id) ?? 0);
        if (payRemaining <= 0 || invRemaining <= 0) continue;

        const amount = Math.min(payRemaining, invRemaining, inv.outstandingAmount);
        if (amount <= 0) continue;

        const dateDiffDays = Math.abs(
          (inv.postingDate.getTime() - pay.paymentDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const score = 100 - dateDiffDays * 0.5;

        matches.push({
          paymentId: pay.id,
          paymentNumber: pay.paymentNumber,
          invoiceType: inv.voucherType,
          invoiceId: inv.voucherId,
          invoiceNumber: inv.voucherNumber,
          amount,
          score: Math.max(0, score),
        });

        usedPayment.set(pay.id, (usedPayment.get(pay.id) ?? 0) + amount);
        usedInvoice.set(key, (usedInvoice.get(key) ?? 0) + amount);
        invRemaining -= amount;
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Apply allocations. Calls AllocationService for each payment's allocations.
   */
  async apply(
    partyType: 'customer' | 'supplier',
    partyId: number,
    allocations: { paymentId: number; invoiceType: 'sale' | 'purchase'; invoiceId: number; amount: number }[],
    userId: number,
  ): Promise<{ success: boolean; allocated: number }> {
    const grouped = new Map<number, AllocationInput[]>();
    for (const a of allocations) {
      if (a.amount <= 0) continue;
      const list = grouped.get(a.paymentId) ?? [];
      list.push({ invoiceType: a.invoiceType, invoiceId: a.invoiceId, amount: a.amount });
      grouped.set(a.paymentId, list);
    }

    let totalAllocated = 0;

    await this.prisma.$transaction(async (tx) => {
      await PeriodLockGuard.check(new Date(), null, tx);

      for (const [paymentId, allocs] of grouped) {
        await this.allocationService.allocate(paymentId, allocs, tx);
        totalAllocated += allocs.reduce((s, a) => s + a.amount, 0);
      }
    });

    return { success: true, allocated: totalAllocated };
  }
}
