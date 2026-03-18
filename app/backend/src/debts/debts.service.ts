import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createPaginatedResult } from '../common';
import { PdfService } from '../pdf/pdf.service';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { buildReportPdfOptions } from '../pdf/templates/report.template';
import { formatDateForHeader } from '../pdf/pdf.helpers';
import { localizeDebtStatus } from '../pdf/pdf.localization';
import { DebtQueryDto } from './dto/debt.dto';
import { Prisma } from '@prisma/client';

// Status mapping from DB values to frontend-expected values
const STATUS_MAP: Record<string, string> = {
  open: 'outstanding',
  paid: 'settled',
  partial: 'partial',
  overdue: 'outstanding',
  written_off: 'written_off',
};

@Injectable()
export class DebtsService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) { }

  /**
   * Transform a raw Prisma Debt row into the DTO shape expected by the frontend.
   *
   * Field mapping:
   *  DB `totalAmount`  → DTO `originalAmount`
   *  DB `amountPaid`   → DTO `amountPaid`  (+ computed `remainingAmount`)
   *  DB `direction`    → DTO `debtType`
   *  DB `partyName`    → DTO `partyName` AND `customerName` / `supplierName`
   *  DB `debtNumber`   → DTO `debtNumber` AND `saleNumber` / `purchaseNumber` (by sourceType)
   *  DB `status`       → mapped via STATUS_MAP to frontend enum
   */
  private toDebtDto(debt: any) {
    const originalAmount: number =
      typeof debt.totalAmount === 'number' ? debt.totalAmount : 0;
    const amountPaid: number =
      typeof debt.amountPaid === 'number' ? debt.amountPaid : 0;
    const remainingAmount = Math.max(0, originalAmount - amountPaid);

    const isOverdue = debt.dueDate
      ? new Date(debt.dueDate) < new Date()
      : false;

    const customerName =
      debt.partyType === 'customer' ? (debt.partyName ?? undefined) : undefined;
    const supplierName =
      debt.partyType === 'supplier' ? (debt.partyName ?? undefined) : undefined;

    const saleNumber =
      debt.sourceType === 'sale' ? debt.debtNumber ?? String(debt.sourceId) : undefined;
    const purchaseNumber =
      debt.sourceType === 'purchase' ? debt.debtNumber ?? String(debt.sourceId) : undefined;

    return {
      ...debt,
      debtType: debt.direction,
      originalAmount,
      amountPaid,
      remainingAmount,
      customerName,
      supplierName,
      saleNumber,
      purchaseNumber,
      isOverdue,
      status: STATUS_MAP[debt.status] ?? debt.status,
    };
  }

  private buildWhere(direction: 'receivable' | 'payable', query: DebtQueryDto): Prisma.DebtWhereInput {
    const where: Prisma.DebtWhereInput = { direction };

    if (query.status) where.status = query.status;

    if (query.customerId) {
      where.partyType = 'customer';
      where.partyId = query.customerId;
    }

    if (query.supplierId) {
      where.partyType = 'supplier';
      where.partyId = query.supplierId;
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { debtNumber: { contains: search } },
        { partyName: { contains: search } },
        { notes: { contains: search } },
      ];
    }

    return where;
  }

  async findReceivables(query: DebtQueryDto) {
    const { page = 1, pageSize = 20 } = query;
    const skip = (page - 1) * pageSize;
    const where = this.buildWhere('receivable', query);

    const [debts, totalItems] = await Promise.all([
      this.prisma.debt.findMany({
        skip,
        take: pageSize,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.debt.count({ where }),
    ]);

    return createPaginatedResult(debts.map((d) => this.toDebtDto(d)), page, pageSize, totalItems);
  }

  async findPayables(query: DebtQueryDto) {
    const { page = 1, pageSize = 20 } = query;
    const skip = (page - 1) * pageSize;
    const where = this.buildWhere('payable', query);

    const [debts, totalItems] = await Promise.all([
      this.prisma.debt.findMany({
        skip,
        take: pageSize,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.debt.count({ where }),
    ]);

    return createPaginatedResult(debts.map((d) => this.toDebtDto(d)), page, pageSize, totalItems);
  }

  async findById(id: number) {
    const debt = await this.prisma.debt.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!debt) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Debt not found',
        messageAr: 'الدين غير موجود',
      });
    }

    // Get related payments
    const payments = await this.prisma.payment.findMany({
      where: { referenceType: 'debt', referenceId: id },
    });

    return { ...this.toDebtDto(debt), payments };
  }

  async getSummary() {
    const receivables = await this.prisma.debt.aggregate({
      // Exclude both paid AND written-off — written-off debts are forgiven, not collectible
      where: { direction: 'receivable', status: { notIn: ['paid', 'written_off'] } },
      _sum: { totalAmount: true, amountPaid: true },
    });

    const payables = await this.prisma.debt.aggregate({
      where: { direction: 'payable', status: { notIn: ['paid', 'written_off'] } },
      _sum: { totalAmount: true, amountPaid: true },
    });

    const totalReceivables = (receivables._sum?.totalAmount ?? 0) - (receivables._sum?.amountPaid ?? 0);
    const totalPayables = (payables._sum?.totalAmount ?? 0) - (payables._sum?.amountPaid ?? 0);

    return {
      totalReceivables,
      totalPayables,
      netPosition: totalReceivables - totalPayables,
    };
  }

  async getCustomerBalance(customerId: number) {
    const debts = await this.prisma.debt.findMany({
      where: {
        direction: 'receivable',
        partyType: 'customer',
        partyId: customerId,
        // Exclude written-off — they are forgiven, should not count as owed
        status: { notIn: ['paid', 'written_off'] },
      },
    });

    const totalOwed = debts.reduce((sum, d) => sum + (d.totalAmount - d.amountPaid), 0);

    return {
      customerId,
      totalOwed,
      debts,
    };
  }

  async getSupplierBalance(supplierId: number) {
    const debts = await this.prisma.debt.findMany({
      where: {
        direction: 'payable',
        partyType: 'supplier',
        partyId: supplierId,
        // Exclude written-off — they are forgiven, should not count as owed
        status: { notIn: ['paid', 'written_off'] },
      },
    });

    const totalOwed = debts.reduce((sum, d) => sum + (d.totalAmount - d.amountPaid), 0);

    return {
      supplierId,
      totalOwed,
      debts,
    };
  }

  async getAgingReport(direction: 'receivable' | 'payable') {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);

    const debts = await this.prisma.debt.findMany({
      where: { direction, status: { notIn: ['paid', 'written_off'] } },
    });

    const aging = {
      current: 0, // 0-30 days
      thirtyDays: 0, // 31-60 days
      sixtyDays: 0, // 61-90 days
      ninetyPlus: 0, // 90+ days
    };

    for (const debt of debts) {
      const outstanding = debt.totalAmount - debt.amountPaid;
      // WK-03: Use dueDate for aging (fall back to createdAt if no dueDate set)
      const referenceDate = debt.dueDate ? new Date(debt.dueDate) : new Date(debt.createdAt);

      if (referenceDate > thirtyDaysAgo) {
        aging.current += outstanding;
      } else if (referenceDate > sixtyDaysAgo) {
        aging.thirtyDays += outstanding;
      } else if (referenceDate > ninetyDaysAgo) {
        aging.sixtyDays += outstanding;
      } else {
        aging.ninetyPlus += outstanding;
      }
    }

    return aging;
  }

  async getOverdue() {
    const today = new Date();

    const overdueDebts = await this.prisma.debt.findMany({
      where: {
        // Exclude written-off — a forgiven debt cannot be overdue
        status: { notIn: ['paid', 'written_off'] },
        dueDate: { lt: today },
      },
      orderBy: { dueDate: 'asc' },
    });

    const receivables = overdueDebts.filter((d) => d.direction === 'receivable');
    const payables = overdueDebts.filter((d) => d.direction === 'payable');

    return {
      totalOverdue: overdueDebts.length,
      receivables: {
        count: receivables.length,
        amount: receivables.reduce((sum, d) => sum + (d.totalAmount - d.amountPaid), 0),
        items: receivables.map((d) => this.toDebtDto(d)),
      },
      payables: {
        count: payables.length,
        amount: payables.reduce((sum, d) => sum + (d.totalAmount - d.amountPaid), 0),
        items: payables.map((d) => this.toDebtDto(d)),
      },
    };
  }

  async writeOff(id: number, reason: string, userId: number) {
    const debt = await this.prisma.debt.findUnique({ where: { id } });

    if (!debt) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Debt not found',
        messageAr: 'الدين غير موجود',
      });
    }

    if (debt.status === 'written_off') {
      throw new BadRequestException({
        code: 'ALREADY_WRITTEN_OFF',
        message: 'This debt has already been written off',
        messageAr: 'تم شطب هذا الدين مسبقاً',
      });
    }

    const remaining = debt.totalAmount - debt.amountPaid;

    return this.prisma.$transaction(async (tx) => {
      await tx.debt.update({
        where: { id },
        data: { status: 'written_off', notes: reason },
      });

      // WK-11: Decrement customer balance for the written-off remainder
      if (debt.partyType === 'customer' && debt.partyId && remaining > 0) {
        await tx.customer.update({
          where: { id: debt.partyId },
          data: { currentBalance: { decrement: remaining } },
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: 'debt',
          entityId: id,
          action: 'write_off',
          changes: JSON.stringify({ reason, previousStatus: debt.status, remainingWrittenOff: remaining }),
          userId,
          username: 'system',
          ipAddress: '127.0.0.1',
        },
      });

      return { success: true };
    });
  }

  async getReceivablesPdf(query: PdfQueryDto) {
    const language = query.language || 'en';
    const debts = await this.prisma.debt.findMany({
      // Exclude written-off — they should not appear as outstanding in the PDF report
      where: { direction: 'receivable', status: { notIn: ['paid', 'written_off'] } },
      orderBy: { totalAmount: 'desc' },
    });

    const meta = await this.pdfService.getStoreMeta(this.prisma, language);

    const rows = debts.map(d => ({
      party: d.partyName || 'Unknown',
      date: d.createdAt.toISOString().split('T')[0],
      total: d.totalAmount,
      paid: d.amountPaid,
      balance: d.totalAmount - d.amountPaid,
      status: localizeDebtStatus(d.status, language)
    }));

    const totalReceivable = rows.reduce((sum, r) => sum + r.balance, 0);

    const options = buildReportPdfOptions(meta as any, {
      title: 'Accounts Receivable Report',
      titleAr: 'تقرير الذمم المدينة',
      subtitle: `As of ${formatDateForHeader(new Date())}`,
      subtitleAr: `اعتباراً من ${formatDateForHeader(new Date())}`,
      columns: [
        { header: 'Party', headerAr: 'العميل', field: 'party', width: '*' },
        { header: 'Date', headerAr: 'التاريخ', field: 'date', width: 'auto', format: 'date' },
        { header: 'Total', headerAr: 'الإجمالي', field: 'total', width: 'auto', format: 'currency' },
        { header: 'Paid', headerAr: 'المدفوع', field: 'paid', width: 'auto', format: 'currency' },
        { header: 'Balance', headerAr: 'الرصيد', field: 'balance', width: 'auto', format: 'currency', bold: true },
      ],
      rows,
      summaryItems: [
        { label: 'Total Receivables', labelAr: 'إجمالي الذمم', value: totalReceivable, format: 'currency', bold: true }
      ]
    });

    return this.pdfService.generate(options);
  }

  async getPayablesPdf(query: PdfQueryDto) {
    const language = query.language || 'en';
    const debts = await this.prisma.debt.findMany({
      // Exclude written-off — they should not appear as outstanding in the PDF report
      where: { direction: 'payable', status: { notIn: ['paid', 'written_off'] } },
      orderBy: { totalAmount: 'desc' },
    });

    const meta = await this.pdfService.getStoreMeta(this.prisma, language);

    const rows = debts.map(d => ({
      party: d.partyName || 'Unknown',
      date: d.createdAt.toISOString().split('T')[0],
      total: d.totalAmount,
      paid: d.amountPaid,
      balance: d.totalAmount - d.amountPaid,
      status: localizeDebtStatus(d.status, language)
    }));

    const totalPayable = rows.reduce((sum, r) => sum + r.balance, 0);

    const options = buildReportPdfOptions(meta as any, {
      title: 'Accounts Payable Report',
      titleAr: 'تقرير الذمم الدائنة',
      subtitle: `As of ${formatDateForHeader(new Date())}`,
      subtitleAr: `اعتباراً من ${formatDateForHeader(new Date())}`,
      columns: [
        { header: 'Party', headerAr: 'المورد', field: 'party', width: '*' },
        { header: 'Date', headerAr: 'التاريخ', field: 'date', width: 'auto', format: 'date' },
        { header: 'Total', headerAr: 'الإجمالي', field: 'total', width: 'auto', format: 'currency' },
        { header: 'Paid', headerAr: 'المدفوع', field: 'paid', width: 'auto', format: 'currency' },
        { header: 'Balance', headerAr: 'الرصيد', field: 'balance', width: 'auto', format: 'currency', bold: true },
      ],
      rows,
      summaryItems: [
        { label: 'Total Payables', labelAr: 'إجمالي الدائن', value: totalPayable, format: 'currency', bold: true }
      ]
    });

    return this.pdfService.generate(options);
  }
}
