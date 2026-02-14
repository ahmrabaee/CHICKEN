import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentLedgerService } from '../payment-ledger/payment-ledger.service';
import { OutstandingCalculatorService } from '../payment-ledger/outstanding-calculator.service';
import { ACCOUNT_CODES } from '../accounting.service';
import { DocumentStatusGuard, PeriodLockGuard } from '../../common';

export interface AllocationInput {
  invoiceType: 'sale' | 'purchase';
  invoiceId: number;
  amount: number;
}

/**
 * Blueprint 04: Allocation Service
 * Allocates payment to invoices. Creates PaymentAllocation + PLE.
 * Validates: no over-allocation, amount <= outstanding.
 */
@Injectable()
export class AllocationService {
  constructor(
    private prisma: PrismaService,
    private paymentLedgerService: PaymentLedgerService,
    private outstandingCalculator: OutstandingCalculatorService,
  ) {}

  /**
   * Allocate a payment to one or more invoices.
   * Creates PaymentAllocation and PLE for each allocation.
   */
  async allocate(paymentId: number, allocations: AllocationInput[], tx?: any): Promise<void> {
    const db = tx ?? this.prisma;

    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: { allocations: true },
    });

    if (!payment) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Payment not found' });
    }

    const docstatus = (payment as { docstatus?: number }).docstatus ?? (payment.isVoided ? 2 : 1);
    DocumentStatusGuard.requireSubmitted({ docstatus });
    if (payment.isVoided) {
      throw new BadRequestException({ code: 'VOIDED', message: 'Payment is voided' });
    }

    const totalAllocate = allocations.reduce((s, a) => s + a.amount, 0);
    const existingFromAllocations = payment.allocations.reduce(
      (s: number, a: { allocatedAmount: number }) => s + a.allocatedAmount,
      0,
    );
    const isAdvance = !payment.referenceType && !payment.referenceId;
    const existingFromPLE = isAdvance ? 0 : await this.getPleAllocatedForPayment(paymentId, db);
    const existingAllocated = Math.max(existingFromAllocations, existingFromPLE);
    const maxAllocatable = payment.amount - existingAllocated;

    if (totalAllocate > maxAllocatable) {
      throw new BadRequestException({
        code: 'OVER_ALLOCATION',
        message: `Total allocation ${totalAllocate} exceeds available ${maxAllocatable}`,
        messageAr: 'إجمالي التخصيص يتجاوز المبلغ المتاح',
      });
    }

    if (totalAllocate <= 0) return;

    const partyType = payment.partyType as 'customer' | 'supplier';
    const partyId = payment.partyId;
    if (!partyType || !partyId) {
      throw new BadRequestException({
        code: 'NO_PARTY',
        message: 'Payment must have partyType and partyId for allocation',
      });
    }

    await PeriodLockGuard.check(payment.paymentDate, null, db);

    for (const alloc of allocations) {
      if (alloc.amount <= 0) continue;

      const outstanding = await this.outstandingCalculator.getOutstanding(
        alloc.invoiceType,
        alloc.invoiceId,
        db,
      );

      if (alloc.amount > outstanding) {
        throw new BadRequestException({
          code: 'EXCEEDS_OUTSTANDING',
          message: `Amount ${alloc.amount} exceeds outstanding ${outstanding} for ${alloc.invoiceType}#${alloc.invoiceId}`,
          messageAr: 'المبلغ يتجاوز المستحق',
        });
      }

      if (alloc.amount > 0) {
        await db.paymentAllocation.upsert({
          where: {
            paymentId_invoiceType_invoiceId: {
              paymentId,
              invoiceType: alloc.invoiceType,
              invoiceId: alloc.invoiceId,
            },
          },
          create: {
            paymentId,
            invoiceType: alloc.invoiceType,
            invoiceId: alloc.invoiceId,
            allocatedAmount: alloc.amount,
          },
          update: {
            allocatedAmount: { increment: alloc.amount },
          },
        });

        const accountId = await this.getAccountIdByCode(
          partyType === 'customer' ? ACCOUNT_CODES.ACCOUNTS_RECEIVABLE : ACCOUNT_CODES.ACCOUNTS_PAYABLE,
          db,
        );

        const isAdvance = !payment.referenceType && !payment.referenceId;
        if (partyType === 'customer') {
          if (isAdvance) {
            await this.paymentLedgerService.createPLE(
              {
                partyType: 'customer',
                partyId,
                accountType: 'receivable',
                accountId,
                voucherType: 'payment',
                voucherId: paymentId,
                againstVoucherType: null,
                againstVoucherId: null,
                amount: alloc.amount,
                postingDate: payment.paymentDate,
                remarks: `Advance reduction (allocated to Sale #${alloc.invoiceId})`,
              },
              db,
            );
          }
          await this.paymentLedgerService.createPLE(
            {
              partyType: 'customer',
              partyId,
              accountType: 'receivable',
              accountId,
              voucherType: 'payment',
              voucherId: paymentId,
              againstVoucherType: 'sale',
              againstVoucherId: alloc.invoiceId,
              amount: -alloc.amount,
              postingDate: payment.paymentDate,
              remarks: `Allocation against Sale #${alloc.invoiceId}`,
            },
            db,
          );
        } else {
          if (isAdvance) {
            await this.paymentLedgerService.createPLE(
              {
                partyType: 'supplier',
                partyId,
                accountType: 'payable',
                accountId,
                voucherType: 'payment',
                voucherId: paymentId,
                againstVoucherType: null,
                againstVoucherId: null,
                amount: -alloc.amount,
                postingDate: payment.paymentDate,
                remarks: `Advance reduction (allocated to Purchase #${alloc.invoiceId})`,
              },
              db,
            );
          }
          await this.paymentLedgerService.createPLE(
            {
              partyType: 'supplier',
              partyId,
              accountType: 'payable',
              accountId,
              voucherType: 'payment',
              voucherId: paymentId,
              againstVoucherType: 'purchase',
              againstVoucherId: alloc.invoiceId,
              amount: alloc.amount,
              postingDate: payment.paymentDate,
              remarks: `Allocation against Purchase #${alloc.invoiceId}`,
            },
            db,
          );
        }
      }
    }
  }

  private async getAccountIdByCode(code: string, db: any): Promise<number> {
    const acc = await db.account.findUnique({ where: { code } });
    if (!acc) throw new Error(`Account ${code} not found`);
    return acc.id;
  }

  private async getPleAllocatedForPayment(paymentId: number, db: any): Promise<number> {
    const entries = await db.paymentLedgerEntry.findMany({
      where: { voucherType: 'payment', voucherId: paymentId, againstVoucherId: { not: null }, delinked: false },
    });
    return entries.reduce((s: number, e: { amount: number }) => s + Math.abs(e.amount), 0);
  }
}
