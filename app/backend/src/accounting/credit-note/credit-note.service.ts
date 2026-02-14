import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountingService, ACCOUNT_CODES } from '../accounting.service';
import { PaymentLedgerService } from '../payment-ledger/payment-ledger.service';
import { OutstandingCalculatorService } from '../payment-ledger/outstanding-calculator.service';
import { DocumentStatusGuard, PeriodLockGuard } from '../../common';

export interface CreateCreditNoteInput {
  originalInvoiceType: 'sale' | 'purchase';
  originalInvoiceId: number;
  amount: number;
  reason?: string;
  branchId?: number;
}

/**
 * Blueprint 04: Credit Note Service
 * Create, submit credit notes. On submit: GL + PLE to reduce outstanding.
 */
@Injectable()
export class CreditNoteService {
  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
    private paymentLedgerService: PaymentLedgerService,
    private outstandingCalculator: OutstandingCalculatorService,
  ) {}

  async create(input: CreateCreditNoteInput, userId: number) {
    const inv = await this.getInvoice(input.originalInvoiceType, input.originalInvoiceId);
    const outstanding = await this.outstandingCalculator.getOutstanding(
      input.originalInvoiceType,
      input.originalInvoiceId,
    );

    if (input.amount > outstanding) {
      throw new BadRequestException({
        code: 'EXCEEDS_OUTSTANDING',
        message: `Credit note amount ${input.amount} exceeds outstanding ${outstanding}`,
        messageAr: 'مبلغ الإشعار الدائن يتجاوز المستحق',
      });
    }

    const number = await this.generateCreditNoteNumber();

    return this.prisma.creditNote.create({
      data: {
        creditNoteNumber: number,
        creditNoteDate: new Date(),
        docstatus: 0,
        originalInvoiceType: input.originalInvoiceType,
        originalInvoiceId: input.originalInvoiceId,
        amount: input.amount,
        reason: input.reason,
        branchId: input.branchId,
        createdById: userId,
      },
    });
  }

  async submit(id: number, userId: number) {
    const cn = await this.prisma.creditNote.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!cn) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Credit note not found' });
    DocumentStatusGuard.requireDraft({ docstatus: cn.docstatus });

    const inv = await this.getInvoice(
      cn.originalInvoiceType as 'sale' | 'purchase',
      cn.originalInvoiceId,
    );
    const outstanding = await this.outstandingCalculator.getOutstanding(
      cn.originalInvoiceType,
      cn.originalInvoiceId,
    );
    if (cn.amount > outstanding) {
      throw new BadRequestException({
        code: 'EXCEEDS_OUTSTANDING',
        message: 'Credit note amount exceeds current outstanding',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await PeriodLockGuard.check(new Date(), null, tx);

      const postingDate = cn.creditNoteDate;

      if (cn.originalInvoiceType === 'sale') {
        await this.accountingService.createCreditNoteSaleJournalEntry(
          tx,
          cn.id,
          cn.creditNoteNumber,
          inv.branchId,
          userId,
          cn.amount,
        );
        const sale = inv as { customerId: number };
        if (sale.customerId) {
          await this.paymentLedgerService.createPLE(
            {
              partyType: 'customer',
              partyId: sale.customerId,
              accountType: 'receivable',
              accountId: await this.getAccountId(tx, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
              voucherType: 'credit_note',
              voucherId: cn.id,
              againstVoucherType: 'sale',
              againstVoucherId: cn.originalInvoiceId,
              amount: -cn.amount,
              postingDate,
              remarks: `Credit Note #${cn.creditNoteNumber} against Sale #${cn.originalInvoiceId}`,
            },
            tx,
          );
        }
      } else {
        await this.accountingService.createCreditNotePurchaseJournalEntry(
          tx,
          cn.id,
          cn.creditNoteNumber,
          inv.branchId,
          userId,
          cn.amount,
        );
        const purchase = inv as { supplierId: number };
        await this.paymentLedgerService.createPLE(
          {
            partyType: 'supplier',
            partyId: purchase.supplierId,
            accountType: 'payable',
            accountId: await this.getAccountId(tx, ACCOUNT_CODES.ACCOUNTS_PAYABLE),
            voucherType: 'credit_note',
            voucherId: cn.id,
            againstVoucherType: 'purchase',
            againstVoucherId: cn.originalInvoiceId,
            amount: cn.amount,
            postingDate,
            remarks: `Credit Note #${cn.creditNoteNumber} against Purchase #${cn.originalInvoiceId}`,
          },
          tx,
        );
      }

      await tx.creditNote.update({
        where: { id },
        data: {
          docstatus: 1,
          submittedAt: new Date(),
          submittedById: userId,
        },
      });

      return tx.creditNote.findUnique({ where: { id } });
    });
  }

  async findAll(pagination: { page?: number; pageSize?: number; originalInvoiceType?: string; originalInvoiceId?: number }) {
    const page = Number(pagination.page) || 1;
    const pageSize = Math.min(Math.max(Number(pagination.pageSize) || 20, 1), 100);
    const skip = (page - 1) * pageSize;

    const where: { originalInvoiceType?: string; originalInvoiceId?: number } = {};
    if (pagination.originalInvoiceType && pagination.originalInvoiceId) {
      where.originalInvoiceType = pagination.originalInvoiceType;
      where.originalInvoiceId = Number(pagination.originalInvoiceId);
    }

    const [items, total] = await Promise.all([
      this.prisma.creditNote.findMany({
        where,
        skip: Math.max(0, skip),
        take: pageSize,
        orderBy: { creditNoteDate: 'desc' },
        include: { branch: true, createdBy: true },
      }),
      this.prisma.creditNote.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: number) {
    const cn = await this.prisma.creditNote.findUnique({
      where: { id },
      include: { branch: true, createdBy: true },
    });
    if (!cn) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Credit note not found' });
    return cn;
  }

  private async getInvoice(type: 'sale' | 'purchase', id: number) {
    if (type === 'sale') {
      const s = await this.prisma.sale.findUnique({ where: { id } });
      if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sale not found' });
      return s;
    }
    const p = await this.prisma.purchase.findUnique({ where: { id } });
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Purchase not found' });
    return p;
  }

  private async getAccountId(tx: any, code: string): Promise<number> {
    const acc = await tx.account.findUnique({ where: { code } });
    if (!acc) throw new Error(`Account ${code} not found`);
    return acc.id;
  }

  private async generateCreditNoteNumber(): Promise<string> {
    const count = await this.prisma.creditNote.count();
    return `CN-${(count + 1).toString().padStart(6, '0')}`;
  }
}
