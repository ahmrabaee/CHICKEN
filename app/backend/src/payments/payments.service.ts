import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createPaginatedResult, PaginationQueryDto } from '../common';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

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

    // Get existing payments for this sale
    const existingPayments = await this.prisma.payment.findMany({
      where: { referenceType: 'sale', referenceId: dto.saleId, isVoided: false },
    });
    const paidAmount = existingPayments.reduce((sum: number, p) => sum + p.amount, 0);
    const amountDue = sale.totalAmount - paidAmount;

    if (dto.amount > amountDue) {
      throw new BadRequestException({
        code: 'OVERPAYMENT',
        message: 'Payment amount exceeds amount due',
        messageAr: 'مبلغ الدفع يتجاوز المبلغ المستحق',
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
          receiptNumber: dto.receiptNumber,
          receivedById: userId,
          branchId: sale.branchId,
          notes: dto.notes,
        },
      });

      // Update sale payment status
      const newPaidAmount = paidAmount + dto.amount;
      const paymentStatus = newPaidAmount >= sale.totalAmount ? 'paid' 
        : newPaidAmount > 0 ? 'partial' : 'unpaid';

      await tx.sale.update({
        where: { id: dto.saleId },
        data: { 
          amountPaid: newPaidAmount,
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

    // Get existing payments for this purchase
    const existingPayments = await this.prisma.payment.findMany({
      where: { referenceType: 'purchase', referenceId: dto.purchaseId, isVoided: false },
    });
    const paidAmount = existingPayments.reduce((sum: number, p) => sum + p.amount, 0);
    const amountDue = purchase.totalAmount - paidAmount;

    if (dto.amount > amountDue) {
      throw new BadRequestException({
        code: 'OVERPAYMENT',
        message: 'Payment amount exceeds amount due',
        messageAr: 'مبلغ الدفع يتجاوز المبلغ المستحق',
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
          receiptNumber: dto.receiptNumber,
          receivedById: userId,
          branchId: purchase.branchId,
          notes: dto.notes,
        },
      });

      // Update purchase payment status
      const newPaidAmount = paidAmount + dto.amount;
      const paymentStatus = newPaidAmount >= purchase.totalAmount ? 'paid' 
        : newPaidAmount > 0 ? 'partial' : 'unpaid';

      await tx.purchase.update({
        where: { id: dto.purchaseId },
        data: { paymentStatus },
      });

      // Update debt if exists
      await tx.debt.updateMany({
        where: { sourceType: 'purchase', sourceId: dto.purchaseId },
        data: { 
          amountPaid: { increment: dto.amount },
          status: paymentStatus === 'paid' ? 'paid' : 'partial',
        },
      });

      return payment;
    });
  }

  async voidPayment(id: number, reason: string, userId: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });

    if (!payment) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Payment not found',
        messageAr: 'الدفعة غير موجودة',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id },
        data: { isVoided: true, notes: reason },
      });

      // Reverse the payment effects based on reference type
      if (payment.referenceType === 'sale') {
        await tx.sale.update({
          where: { id: payment.referenceId },
          data: { amountPaid: { decrement: payment.amount } },
        });

        // Update debt
        await tx.debt.updateMany({
          where: { sourceType: 'sale', sourceId: payment.referenceId },
          data: { amountPaid: { decrement: payment.amount } },
        });
      } else if (payment.referenceType === 'purchase') {
        // Update debt
        await tx.debt.updateMany({
          where: { sourceType: 'purchase', sourceId: payment.referenceId },
          data: { amountPaid: { decrement: payment.amount } },
        });
      }

      // Log audit
      await tx.auditLog.create({
        data: {
          entityType: 'payment',
          entityId: id,
          action: 'void',
          changes: JSON.stringify({ reason }),
          userId,
          username: 'system',
          ipAddress: '127.0.0.1',
        },
      });

      return { success: true };
    });
  }

  private async generatePaymentNumber(): Promise<string> {
    const count = await this.prisma.payment.count();
    return `PAY-${(count + 1).toString().padStart(6, '0')}`;
  }
}
