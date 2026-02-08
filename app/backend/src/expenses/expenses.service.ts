import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { createPaginatedResult, PaginationQueryDto } from '../common';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private accountingService: AccountingService,
  ) {}

  async findAll(pagination: PaginationQueryDto, expenseType?: string) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where = expenseType ? { expenseType } : {};

    const [expenses, totalItems] = await Promise.all([
      this.prisma.expense.findMany({
        skip,
        take: pageSize,
        where,
        include: { category: true, supplier: true, createdBy: true },
        orderBy: { expenseDate: 'desc' },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return createPaginatedResult(expenses, page, pageSize, totalItems);
  }

  async findById(id: number) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: { category: true, supplier: true, createdBy: true, approvedBy: true },
    });

    if (!expense) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Expense not found',
        messageAr: 'المصروف غير موجود',
      });
    }

    return expense;
  }

  async create(dto: any, userId: number) {
    const expenseNumber = await this.generateExpenseNumber();

    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
          expenseType: dto.expenseType ?? 'operational',
          categoryId: dto.categoryId,
          amount: dto.amount,
          taxAmount: dto.taxAmount ?? 0,
          description: dto.description,
          supplierId: dto.supplierId,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber,
          branchId: dto.branchId,
          attachmentUrl: dto.attachmentUrl,
          notes: dto.notes,
          createdById: userId,
        },
      });

      // Create accounting journal entry
      await this.accountingService.createExpenseJournalEntry(
        tx,
        expense.id,
        expense.expenseNumber,
        dto.branchId ?? null,
        userId,
        dto.amount,
        dto.paymentMethod,
      );

      return expense;
    });
  }

  async update(id: number, dto: any, userId: number) {
    await this.findById(id);

    return this.prisma.expense.update({
      where: { id },
      data: {
        expenseType: dto.expenseType,
        categoryId: dto.categoryId,
        amount: dto.amount,
        taxAmount: dto.taxAmount,
        description: dto.description,
        supplierId: dto.supplierId,
        paymentMethod: dto.paymentMethod,
        notes: dto.notes,
      },
    });
  }

  async approve(id: number, userId: number) {
    const expense = await this.findById(id);

    return this.prisma.expense.update({
      where: { id },
      data: {
        isApproved: true,
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  }

  async delete(id: number) {
    await this.findById(id);
    return this.prisma.expense.delete({ where: { id } });
  }

  async getSummaryByType(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate) where.expenseDate = { gte: new Date(startDate) };
    if (endDate) where.expenseDate = { ...where.expenseDate, lte: new Date(endDate) };

    const grouped = await this.prisma.expense.groupBy({
      by: ['expenseType'],
      where,
      _sum: { amount: true },
    });

    return grouped.map((g) => ({
      expenseType: g.expenseType,
      totalAmount: g._sum?.amount ?? 0,
    }));
  }

  async getCategories() {
    return this.prisma.expenseCategory.findMany({
      where: { isActive: true },
      include: { parentCategory: true },
    });
  }

  private async generateExpenseNumber(): Promise<string> {
    const count = await this.prisma.expense.count();
    return `EXP-${(count + 1).toString().padStart(6, '0')}`;
  }
}
