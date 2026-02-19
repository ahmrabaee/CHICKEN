import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { PaymentLedgerService } from '../accounting/payment-ledger/payment-ledger.service';
import {
  createPaginatedResult,
  PaginationQueryDto,
  DocumentStatusGuard,
  PeriodLockGuard,
} from '../common';
import { ACCOUNT_CODES } from '../accounting/accounting.service';
import { PdfService } from '../pdf/pdf.service';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { buildPaymentVoucherPdfOptions } from '../pdf/templates/payment-voucher.template';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
    private paymentLedgerService: PaymentLedgerService,
    private pdfService: PdfService,
  ) { }

  async findAll(pagination: PaginationQueryDto, referenceType?: string) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where = referenceType ? { referenceType } : {};

    const [payments, totalItems] = await Promise.all([
      this.prisma.payment.findMany({
        skip,
        take: pageSize,
        where,
        include: { receivedBy: true, branch: true },
        orderBy: { paymentDate: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return createPaginatedResult(payments, page, pageSize, totalItems);
  }

  async findById(id: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { receivedBy: true, branch: true },
    });

    if (!payment) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payment not found',
        messageAr: 'الدفعة غير موجودة',
      });
    }

    return payment;
  }

  async getPaymentPdf(id: number, query: PdfQueryDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { receivedBy: true, branch: true },
    });

    if (!payment) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payment not found',
        messageAr: 'الدفعة غير موجودة',
      });
    }

    let referenceNumber: string | undefined;
    if (payment.referenceType === 'sale' && payment.referenceId) {
      const sale = await this.prisma.sale.findUnique({
        where: { id: payment.referenceId },
        select: { saleNumber: true },
      });
      referenceNumber = sale?.saleNumber;
    } else if (payment.referenceType === 'purchase' && payment.referenceId) {
      const purchase = await this.prisma.purchase.findUnique({
        where: { id: payment.referenceId },
        select: { purchaseNumber: true },
      });
      referenceNumber = purchase?.purchaseNumber;
    }

    const meta = await this.pdfService.getStoreMeta(this.prisma, query.language || 'en');

    const pdfData = {
      paymentNumber: payment.paymentNumber,
      date: payment.paymentDate.toISOString(),
      amount: payment.amount,
      method: payment.paymentMethod,
      partyName: payment.partyName || undefined,
      partyType: payment.partyType || undefined,
      referenceType: payment.referenceType || undefined,
      referenceId: payment.referenceId || undefined,
      referenceNumber,
      receivedBy: payment.receivedBy?.fullName || 'System',
      branchName: payment.branch?.name || undefined,
      notes: payment.notes || undefined,
      status: payment.isVoided ? 'Voided' : 'Valid',
      isVoided: payment.isVoided,
    };

    const options = buildPaymentVoucherPdfOptions(meta as any, pdfData);
    return this.pdfService.generate(options);
  }

  async recordSalePayment(dto: any, userId: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: dto.saleId },
    });

    if (!sale) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Sale not found',
        messageAr: 'الفاتورة غير موجودة',
      });
    }

    // Use sale.amountPaid as the base for amount due calculation
    const currentPaidAmount = sale.amountPaid ?? 0;
    const totalAmount = sale.totalAmount;
    const amountDue = totalAmount - currentPaidAmount;

    if (dto.amount > amountDue) {
      const fmt = (n: number) => (n / 100).toFixed(2);
      throw new BadRequestException({
        code: 'OVERPAYMENT',
        message: `Payment amount (${fmt(dto.amount)} ₪) exceeds amount due (${fmt(amountDue)} ₪)`,
        messageAr: `مبلغ الدفع (${fmt(dto.amount)} ₪) يتجاوز المبلغ المستحق (${fmt(amountDue)} ₪)`,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const paymentNumber = await this.generatePaymentNumber();

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          amount: dto.amount,
          paymentMethod: dto.paymentMethod ?? 'cash',
          referenceType: 'sale',
          referenceId: dto.saleId,
          partyType: sale.customerId ? 'customer' : null,
          partyId: sale.customerId,
          partyName: sale.customerName,
          receiptNumber: dto.referenceNumber,
          receivedById: userId,
          branchId: sale.branchId,
          notes: dto.notes,
          docstatus: 1,
        },
      });

      // Update sale payment status
      const newPaidAmount = currentPaidAmount + dto.amount;
      const paymentStatus = newPaidAmount >= totalAmount ? 'paid'
        : newPaidAmount > 0 ? 'partial' : 'unpaid';

      await tx.sale.update({
        where: { id: dto.saleId },
        data: {
          amountPaid: { increment: dto.amount },
          paymentStatus,
        },
      });

      // Update debt if exists
      await tx.debt.updateMany({
        where: { sourceType: 'sale', sourceId: dto.saleId },
        data: {
          amountPaid: { increment: dto.amount },
          status: paymentStatus === 'paid' ? 'paid' : 'partial',
        },
      });

      // Create journal entry for payment received
      await this.accountingService.createPaymentReceivedJournalEntry(
        tx,
        payment.id,
        payment.paymentNumber,
        sale.branchId ?? null,
        userId,
        dto.amount,
      );

      // Blueprint 04: PLE for payment against sale
      if (sale.customerId) {
        await this.paymentLedgerService.createPLEForPaymentAgainstSale(
          tx,
          payment.id,
          dto.saleId,
          sale.customerId,
          dto.amount,
          payment.paymentDate,
        );
      }

      return payment;
    });
  }

  async recordPurchasePayment(dto: any, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: dto.purchaseId },
    });

    if (!purchase) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Purchase not found',
        messageAr: 'أمر الشراء غير موجود',
      });
    }

    // Use purchase.amountPaid as the base for amount due calculation
    // This accounts for the initial payment made during purchase creation
    const currentPaidAmount = purchase.amountPaid ?? 0;
    const totalAmount = purchase.grandTotal ?? purchase.totalAmount;
    const amountDue = totalAmount - currentPaidAmount;

    if (dto.amount > amountDue) {
      const fmt = (n: number) => (n / 100).toFixed(2);
      throw new BadRequestException({
        code: 'OVERPAYMENT',
        message: `Payment amount (${fmt(dto.amount)} ₪) exceeds amount due (${fmt(amountDue)} ₪)`,
        messageAr: `مبلغ الدفع (${fmt(dto.amount)} ₪) يتجاوز المبلغ المستحق (${fmt(amountDue)} ₪)`,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const paymentNumber = await this.generatePaymentNumber();

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          amount: dto.amount,
          paymentMethod: dto.paymentMethod ?? 'cash',
          referenceType: 'purchase',
          referenceId: dto.purchaseId,
          partyType: 'supplier',
          partyId: purchase.supplierId,
          partyName: purchase.supplierName,
          receiptNumber: dto.receiptNumber || dto.referenceNumber,
          receivedById: userId,
          branchId: purchase.branchId,
          notes: dto.notes,
          docstatus: 1,
        },
      });

      // Update purchase amountPaid and status
      const newTotalPaidAmount = currentPaidAmount + dto.amount;
      const paymentStatus = newTotalPaidAmount >= totalAmount ? 'paid'
        : newTotalPaidAmount > 0 ? 'partial' : 'unpaid';

      await tx.purchase.update({
        where: { id: dto.purchaseId },
        data: {
          amountPaid: { increment: dto.amount },
          paymentStatus
        },
      });

      // Update debt if exists
      await tx.debt.updateMany({
        where: { sourceType: 'purchase', sourceId: dto.purchaseId },
        data: {
          amountPaid: { increment: dto.amount },
          status: paymentStatus === 'paid' ? 'paid' : 'partial',
        },
      });

      // Create journal entry for payment made
      await this.accountingService.createPaymentMadeJournalEntry(
        tx,
        payment.id,
        payment.paymentNumber,
        purchase.branchId ?? null,
        userId,
        dto.amount,
      );

      // Blueprint 04: PLE for payment against purchase
      await this.paymentLedgerService.createPLEForPaymentAgainstPurchase(
        tx,
        payment.id,
        dto.purchaseId,
        purchase.supplierId,
        dto.amount,
        payment.paymentDate,
      );

      return payment;
    });
  }

  /**
   * Cancel payment with GL reversal (Blueprint 03).
   * Replaces voidPayment: creates reverse GL entry before updating payment/sale/debt.
   */
  async cancelPayment(id: number, reason: string, userId: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });

    if (!payment) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payment not found',
        messageAr: 'الدفعة غير موجودة',
      });
    }

    // docstatus: 1=Submitted, 2=Cancelled. Fallback for legacy data.
    const docstatus =
      (payment as { docstatus?: number }).docstatus ?? (payment.isVoided ? 2 : 1);
    DocumentStatusGuard.requireNotCancelled({ docstatus });
    DocumentStatusGuard.requireSubmitted({ docstatus });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    return this.prisma.$transaction(async (tx) => {
      await PeriodLockGuard.check(
        new Date(payment.paymentDate),
        null,
        tx,
      );

      // 1. Create GL reversal FIRST (critical fix from Blueprint 03)
      await this.accountingService.reverseByVoucher('payment', id, userId, tx);

      // Blueprint 04: Delink PLE for cancelled payment
      await this.paymentLedgerService.delinkPLEForVoucher('payment', id, tx);

      const now = new Date();

      // 2. Update payment
      await tx.payment.update({
        where: { id },
        data: {
          docstatus: 2,
          isVoided: true,
          cancelledAt: now,
          cancelledById: userId,
          cancelReason: reason,
          notes: reason,
        },
      });

      // 3. Reverse effects on sale/purchase and debt (skip for advance payments)
      if (payment.referenceType === 'sale' && payment.referenceId != null) {
        const sale = await tx.sale.findUnique({
          where: { id: payment.referenceId },
        });
        if (sale) {
          const saleNewPaid = sale.amountPaid - payment.amount;
          const paymentStatus =
            saleNewPaid <= 0 ? 'unpaid' : saleNewPaid >= sale.totalAmount ? 'paid' : 'partial';
          await tx.sale.update({
            where: { id: payment.referenceId },
            data: {
              amountPaid: { decrement: payment.amount },
              paymentStatus,
            },
          });

          const debtStatus =
            saleNewPaid <= 0 ? 'unpaid' : saleNewPaid >= sale.totalAmount ? 'paid' : 'partial';

          await tx.debt.updateMany({
            where: { sourceType: 'sale', sourceId: payment.referenceId },
            data: {
              amountPaid: { decrement: payment.amount },
              status: debtStatus,
            },
          });

          if (sale.customerId) {
            await tx.customer.update({
              where: { id: sale.customerId },
              data: { currentBalance: { increment: payment.amount } },
            });
          }
        }
      } else if (payment.referenceType === 'purchase' && payment.referenceId != null) {
        const purchase = await tx.purchase.findUnique({
          where: { id: payment.referenceId },
        });
        if (purchase) {
          const purchNewPaid = purchase.amountPaid - payment.amount;
          const paymentStatus =
            purchNewPaid <= 0 ? 'unpaid' : purchNewPaid >= purchase.totalAmount ? 'paid' : 'partial';
          await tx.purchase.update({
            where: { id: payment.referenceId },
            data: {
              amountPaid: { decrement: payment.amount },
              paymentStatus,
            },
          });

          const debtStatus =
            purchNewPaid <= 0 ? 'unpaid' : purchNewPaid >= purchase.totalAmount ? 'paid' : 'partial';

          await tx.debt.updateMany({
            where: { sourceType: 'purchase', sourceId: payment.referenceId },
            data: {
              amountPaid: { decrement: payment.amount },
              status: debtStatus,
            },
          });
        }
      }

      // 4. Audit log
      await tx.auditLog.create({
        data: {
          entityType: 'Payment',
          entityId: id,
          action: 'cancel',
          changes: JSON.stringify({ reason }),
          userId,
          username: user?.username ?? 'unknown',
          ipAddress: null,
          userAgent: null,
        },
      });

      return { success: true };
    });
  }

  /**
   * @deprecated Use cancelPayment instead. voidPayment did not create GL reversal.
   */
  async voidPayment(id: number, reason: string, userId: number) {
    return this.cancelPayment(id, reason, userId);
  }

  /**
   * Blueprint 04: Create advance payment (no invoice - for reconciliation later)
   */
  async createAdvancePayment(dto: any, userId: number) {
    const party =
      dto.partyType === 'customer'
        ? await this.prisma.customer.findUnique({ where: { id: dto.partyId } })
        : await this.prisma.supplier.findUnique({ where: { id: dto.partyId } });

    if (!party) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `${dto.partyType} not found`,
      });
    }

    const partyName = (party as { name?: string }).name ?? '';

    return this.prisma.$transaction(async (tx) => {
      const paymentNumber = await this.generatePaymentNumber();

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          amount: dto.amount,
          paymentMethod: dto.paymentMethod ?? 'cash',
          referenceType: null,
          referenceId: null,
          partyType: dto.partyType,
          partyId: dto.partyId,
          partyName,
          receiptNumber: dto.receiptNumber,
          receivedById: userId,
          notes: dto.notes,
          docstatus: 1,
        },
      });

      if (dto.partyType === 'customer') {
        await this.accountingService.createPaymentReceivedJournalEntry(
          tx,
          payment.id,
          payment.paymentNumber,
          null,
          userId,
          dto.amount,
        );
        await this.paymentLedgerService.createPLE(
          {
            partyType: 'customer',
            partyId: dto.partyId,
            accountType: 'receivable',
            accountId: await this.getAccountIdByCodeFromTx(tx, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE),
            voucherType: 'payment',
            voucherId: payment.id,
            againstVoucherType: null,
            againstVoucherId: null,
            amount: -dto.amount,
            postingDate: payment.paymentDate,
            remarks: 'Advance receipt from customer',
          },
          tx,
        );
      } else {
        await this.accountingService.createPaymentMadeJournalEntry(
          tx,
          payment.id,
          payment.paymentNumber,
          null,
          userId,
          dto.amount,
        );
        await this.paymentLedgerService.createPLE(
          {
            partyType: 'supplier',
            partyId: dto.partyId,
            accountType: 'payable',
            accountId: await this.getAccountIdByCodeFromTx(tx, ACCOUNT_CODES.ACCOUNTS_PAYABLE),
            voucherType: 'payment',
            voucherId: payment.id,
            againstVoucherType: null,
            againstVoucherId: null,
            amount: dto.amount,
            postingDate: payment.paymentDate,
            remarks: `Advance payment to supplier`,
          },
          tx,
        );
      }

      return payment;
    });
  }

  private async getAccountIdByCodeFromTx(tx: any, code: string, companyId: number | null = 1): Promise<number> {
    const acc = await tx.account.findFirst({ where: { code, companyId } });
    if (!acc) throw new Error(`Account ${code} not found`);
    return acc.id;
  }

  private async generatePaymentNumber(): Promise<string> {
    const count = await this.prisma.payment.count();
    return `PAY-${(count + 1).toString().padStart(6, '0')}`;
  }
}
