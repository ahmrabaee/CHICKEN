import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createPaginatedResult, PaginationQueryDto } from '../common';

// Standard account codes for the system
export const ACCOUNT_CODES = {
  // Assets (1xxx)
  CASH: '1110',
  BANK: '1120',
  ACCOUNTS_RECEIVABLE: '1200',
  INVENTORY: '1300',
  
  // Liabilities (2xxx)
  ACCOUNTS_PAYABLE: '2100',
  VAT_PAYABLE: '2200',
  
  // Equity (3xxx)
  CAPITAL: '3100',
  RETAINED_EARNINGS: '3200',
  
  // Revenue (4xxx)
  SALES_REVENUE: '4100',
  OTHER_INCOME: '4200',
  
  // Expenses (5xxx)
  COST_OF_GOODS_SOLD: '5100',
  OPERATING_EXPENSES: '5200',
  WASTAGE_EXPENSE: '5300',
  DISCOUNTS_GIVEN: '5400',
};

export interface JournalLineInput {
  accountCode: string;
  debitAmount?: number;
  creditAmount?: number;
  description?: string;
}

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  // ============ AUTO JOURNAL ENTRY CREATION ============

  /**
   * Create journal entry for a sale transaction
   */
  async createSaleJournalEntry(
    tx: any,
    saleId: number,
    saleNumber: string,
    branchId: number | null,
    userId: number,
    data: {
      totalAmount: number;
      totalCost: number;
      amountPaid: number;
      customerId?: number;
      discountAmount?: number;
    },
  ) {
    const lines: JournalLineInput[] = [];
    const { totalAmount, totalCost, amountPaid, discountAmount } = data;
    const amountDue = totalAmount - amountPaid;

    // Revenue side
    // DR Cash (amount paid)
    if (amountPaid > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.CASH,
        debitAmount: amountPaid,
        description: 'Cash received',
      });
    }

    // DR Accounts Receivable (amount due)
    if (amountDue > 0 && data.customerId) {
      lines.push({
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmount: amountDue,
        description: 'Credit sale',
      });
    }

    // CR Sales Revenue
    const netRevenue = totalAmount + (discountAmount ?? 0);
    lines.push({
      accountCode: ACCOUNT_CODES.SALES_REVENUE,
      creditAmount: netRevenue,
      description: 'Sales revenue',
    });

    // DR Discounts Given (if any)
    if (discountAmount && discountAmount > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.DISCOUNTS_GIVEN,
        debitAmount: discountAmount,
        description: 'Sales discount',
      });
    }

    // COGS side
    // DR Cost of Goods Sold
    lines.push({
      accountCode: ACCOUNT_CODES.COST_OF_GOODS_SOLD,
      debitAmount: totalCost,
      description: 'Cost of goods sold',
    });

    // CR Inventory
    lines.push({
      accountCode: ACCOUNT_CODES.INVENTORY,
      creditAmount: totalCost,
      description: 'Inventory reduction',
    });

    return this.createJournalEntryInternal(tx, {
      description: `بيع: ${saleNumber}`,
      sourceType: 'sale',
      sourceId: saleId,
      branchId,
      lines,
      userId,
      autoPost: true,
    });
  }

  /**
   * Create reversal journal entry for voided sale
   */
  async createSaleVoidJournalEntry(
    tx: any,
    saleId: number,
    saleNumber: string,
    branchId: number | null,
    userId: number,
    data: {
      totalAmount: number;
      totalCost: number;
      amountPaid: number;
      discountAmount?: number;
    },
  ) {
    const lines: JournalLineInput[] = [];
    const { totalAmount, totalCost, amountPaid, discountAmount } = data;
    const amountDue = totalAmount - amountPaid;

    // Reverse revenue side
    // CR Cash (refund)
    if (amountPaid > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.CASH,
        creditAmount: amountPaid,
        description: 'Cash refund',
      });
    }

    // CR Accounts Receivable 
    if (amountDue > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        creditAmount: amountDue,
        description: 'Write off receivable',
      });
    }

    // DR Sales Revenue (reverse)
    const netRevenue = totalAmount + (discountAmount ?? 0);
    lines.push({
      accountCode: ACCOUNT_CODES.SALES_REVENUE,
      debitAmount: netRevenue,
      description: 'Sales revenue reversal',
    });

    // CR Discounts Given (reverse)
    if (discountAmount && discountAmount > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.DISCOUNTS_GIVEN,
        creditAmount: discountAmount,
        description: 'Discount reversal',
      });
    }

    // Reverse COGS
    // CR COGS
    lines.push({
      accountCode: ACCOUNT_CODES.COST_OF_GOODS_SOLD,
      creditAmount: totalCost,
      description: 'COGS reversal',
    });

    // DR Inventory
    lines.push({
      accountCode: ACCOUNT_CODES.INVENTORY,
      debitAmount: totalCost,
      description: 'Inventory restoration',
    });

    return this.createJournalEntryInternal(tx, {
      description: `إلغاء بيع: ${saleNumber}`,
      sourceType: 'sale_void',
      sourceId: saleId,
      branchId,
      lines,
      userId,
      autoPost: true,
    });
  }

  /**
   * Create journal entry for purchase/inventory receipt
   */
  async createPurchaseJournalEntry(
    tx: any,
    purchaseId: number,
    purchaseNumber: string,
    branchId: number | null,
    userId: number,
    data: {
      totalAmount: number;
      amountPaid: number;
    },
  ) {
    const lines: JournalLineInput[] = [];
    const { totalAmount, amountPaid } = data;
    const amountDue = totalAmount - amountPaid;

    // DR Inventory
    lines.push({
      accountCode: ACCOUNT_CODES.INVENTORY,
      debitAmount: totalAmount,
      description: 'Inventory purchase',
    });

    // CR Cash (if paid)
    if (amountPaid > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.CASH,
        creditAmount: amountPaid,
        description: 'Cash payment',
      });
    }

    // CR Accounts Payable (if credit)
    if (amountDue > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
        creditAmount: amountDue,
        description: 'Credit purchase',
      });
    }

    return this.createJournalEntryInternal(tx, {
      description: `شراء: ${purchaseNumber}`,
      sourceType: 'purchase',
      sourceId: purchaseId,
      branchId,
      lines,
      userId,
      autoPost: true,
    });
  }

  /**
   * Create journal entry for payment received
   */
  async createPaymentReceivedJournalEntry(
    tx: any,
    paymentId: number,
    paymentNumber: string,
    branchId: number | null,
    userId: number,
    amount: number,
  ) {
    const lines: JournalLineInput[] = [
      {
        accountCode: ACCOUNT_CODES.CASH,
        debitAmount: amount,
        description: 'Payment received',
      },
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        creditAmount: amount,
        description: 'Reduce receivable',
      },
    ];

    return this.createJournalEntryInternal(tx, {
      description: `تحصيل: ${paymentNumber}`,
      sourceType: 'payment',
      sourceId: paymentId,
      branchId,
      lines,
      userId,
      autoPost: true,
    });
  }

  /**
   * Create journal entry for payment made
   */
  async createPaymentMadeJournalEntry(
    tx: any,
    paymentId: number,
    paymentNumber: string,
    branchId: number | null,
    userId: number,
    amount: number,
  ) {
    const lines: JournalLineInput[] = [
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
        debitAmount: amount,
        description: 'Pay supplier',
      },
      {
        accountCode: ACCOUNT_CODES.CASH,
        creditAmount: amount,
        description: 'Cash payment',
      },
    ];

    return this.createJournalEntryInternal(tx, {
      description: `دفع: ${paymentNumber}`,
      sourceType: 'payment',
      sourceId: paymentId,
      branchId,
      lines,
      userId,
      autoPost: true,
    });
  }

  /**
   * Create journal entry for wastage
   */
  async createWastageJournalEntry(
    tx: any,
    wastageId: number,
    branchId: number | null,
    userId: number,
    amount: number,
  ) {
    const lines: JournalLineInput[] = [
      {
        accountCode: ACCOUNT_CODES.WASTAGE_EXPENSE,
        debitAmount: amount,
        description: 'Wastage expense',
      },
      {
        accountCode: ACCOUNT_CODES.INVENTORY,
        creditAmount: amount,
        description: 'Inventory loss',
      },
    ];

    return this.createJournalEntryInternal(tx, {
      description: `هدر مخزون`,
      sourceType: 'wastage',
      sourceId: wastageId,
      branchId,
      lines,
      userId,
      autoPost: true,
    });
  }

  /**
   * Create journal entry for expense
   * DR: Operating Expenses (or specific expense account)
   * CR: Cash or Accounts Payable
   */
  async createExpenseJournalEntry(
    tx: any,
    expenseId: number,
    expenseNumber: string,
    branchId: number | null,
    userId: number,
    amount: number,
    paymentMethod?: string,
  ) {
    const lines: JournalLineInput[] = [
      {
        accountCode: ACCOUNT_CODES.OPERATING_EXPENSES,
        debitAmount: amount,
        description: 'Operating expense',
      },
      paymentMethod === 'credit'
        ? {
            accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
            creditAmount: amount,
            description: 'Expense on credit',
          }
        : {
            accountCode: ACCOUNT_CODES.CASH,
            creditAmount: amount,
            description: 'Cash payment',
          },
    ];

    return this.createJournalEntryInternal(tx, {
      description: `مصروف: ${expenseNumber}`,
      sourceType: 'expense',
      sourceId: expenseId,
      branchId,
      lines,
      userId,
      autoPost: true,
    });
  }

  /**
   * Internal method to create journal entry within a transaction
   */
  private async createJournalEntryInternal(
    tx: any,
    params: {
      description: string;
      sourceType: string;
      sourceId: number;
      branchId: number | null;
      lines: JournalLineInput[];
      userId: number;
      autoPost?: boolean;
    },
  ) {
    // Validate debits = credits
    const totalDebit = params.lines.reduce((sum, l) => sum + (l.debitAmount ?? 0), 0);
    const totalCredit = params.lines.reduce((sum, l) => sum + (l.creditAmount ?? 0), 0);

    if (totalDebit !== totalCredit) {
      throw new BadRequestException({
        code: 'UNBALANCED_ENTRY',
        message: `Unbalanced entry: Debit=${totalDebit}, Credit=${totalCredit}`,
        messageAr: 'القيد غير متوازن',
      });
    }

    const entryNumber = await this.generateEntryNumberTx(tx);

    const entry = await tx.journalEntry.create({
      data: {
        entryNumber,
        entryDate: new Date(),
        description: params.description,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        branchId: params.branchId,
        isPosted: params.autoPost ?? false,
        createdById: params.userId,
      },
    });

    for (let i = 0; i < params.lines.length; i++) {
      const line = params.lines[i];
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: entry.id,
          lineNumber: i + 1,
          accountCode: line.accountCode,
          debitAmount: line.debitAmount ?? 0,
          creditAmount: line.creditAmount ?? 0,
          description: line.description,
        },
      });
    }

    return entry;
  }

  private async generateEntryNumberTx(tx: any): Promise<string> {
    const count = await tx.journalEntry.count();
    return `JE-${(count + 1).toString().padStart(6, '0')}`;
  }

  // ============ CHART OF ACCOUNTS ============

  async getAccounts() {
    return this.prisma.account.findMany({
      where: { isActive: true },
      include: { parentAccount: true, childAccounts: true },
      orderBy: { code: 'asc' },
    });
  }

  async getAccountByCode(code: string) {
    const account = await this.prisma.account.findUnique({
      where: { code },
      include: { parentAccount: true, childAccounts: true },
    });

    if (!account) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Account not found',
        messageAr: 'الحساب غير موجود',
      });
    }

    return account;
  }

  async createAccount(dto: any) {
    return this.prisma.account.create({
      data: {
        code: dto.code,
        name: dto.name,
        nameEn: dto.nameEn,
        accountType: dto.accountType,
        parentAccountCode: dto.parentAccountCode,
        isActive: true,
      },
    });
  }

  async updateAccount(code: string, dto: any) {
    await this.getAccountByCode(code);

    return this.prisma.account.update({
      where: { code },
      data: {
        name: dto.name,
        nameEn: dto.nameEn,
        parentAccountCode: dto.parentAccountCode,
        isActive: dto.isActive,
      },
    });
  }

  // ============ JOURNAL ENTRIES ============

  async getJournalEntries(pagination: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const [entries, totalItems] = await Promise.all([
      this.prisma.journalEntry.findMany({
        skip,
        take: pageSize,
        include: { lines: { include: { account: true } }, createdBy: true },
        orderBy: { entryDate: 'desc' },
      }),
      this.prisma.journalEntry.count(),
    ]);

    return createPaginatedResult(entries, page, pageSize, totalItems);
  }

  async getJournalEntryById(id: number) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { account: true } }, createdBy: true },
    });

    if (!entry) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Journal entry not found',
        messageAr: 'القيد غير موجود',
      });
    }

    return entry;
  }

  async createJournalEntry(dto: any, userId: number) {
    // Validate debits equal credits
    const totalDebit = dto.lines.reduce((sum: number, l: any) => sum + (l.debitAmount ?? 0), 0);
    const totalCredit = dto.lines.reduce((sum: number, l: any) => sum + (l.creditAmount ?? 0), 0);

    if (totalDebit !== totalCredit) {
      throw new BadRequestException({
        code: 'UNBALANCED_ENTRY',
        message: 'Debits must equal credits',
        messageAr: 'يجب أن يتساوى المدين مع الدائن',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const entryNumber = await this.generateEntryNumberTx(tx);

      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          entryDate: dto.entryDate ? new Date(dto.entryDate) : new Date(),
          description: dto.description,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          branchId: dto.branchId,
          createdById: userId,
        },
      });

      for (let i = 0; i < dto.lines.length; i++) {
        const line = dto.lines[i];
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: entry.id,
            lineNumber: i + 1,
            accountCode: line.accountCode,
            debitAmount: line.debitAmount ?? 0,
            creditAmount: line.creditAmount ?? 0,
            description: line.description,
          },
        });
      }

      return this.getJournalEntryById(entry.id);
    });
  }

  async postJournalEntry(id: number) {
    const entry = await this.getJournalEntryById(id);

    if (entry.isPosted) {
      throw new BadRequestException({
        code: 'ALREADY_POSTED',
        message: 'Entry is already posted',
        messageAr: 'القيد مرحل بالفعل',
      });
    }

    return this.prisma.journalEntry.update({
      where: { id },
      data: { isPosted: true },
    });
  }

  async reverseJournalEntry(id: number, userId: number) {
    const entry = await this.getJournalEntryById(id);

    if (entry.isReversed) {
      throw new BadRequestException({
        code: 'ALREADY_REVERSED',
        message: 'Entry is already reversed',
        messageAr: 'القيد معكوس بالفعل',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Create reversal entry
      const reversal = await this.createJournalEntry({
        description: `عكس: ${entry.description}`,
        sourceType: 'adjustment',
        lines: entry.lines.map((l) => ({
          accountCode: l.accountCode,
          debitAmount: l.creditAmount, // Swap
          creditAmount: l.debitAmount,
        })),
      }, userId);

      // Mark original as reversed
      await tx.journalEntry.update({
        where: { id },
        data: { isReversed: true, reversedByEntryId: reversal.id },
      });

      return reversal;
    });
  }

  // ============ TRIAL BALANCE & LEDGER ============

  async getTrialBalance(asOfDate?: string) {
    const dateFilter = asOfDate ? { lte: new Date(asOfDate) } : undefined;

    const grouped = await this.prisma.journalEntryLine.groupBy({
      by: ['accountCode'],
      where: dateFilter 
        ? { journalEntry: { entryDate: dateFilter, isPosted: true } } 
        : { journalEntry: { isPosted: true } },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const accountCodes = grouped.map((g) => g.accountCode);
    const accounts = await this.prisma.account.findMany({
      where: { code: { in: accountCodes } },
    });

    const accountMap = new Map(accounts.map((a) => [a.code, a]));

    return grouped.map((b) => {
      const account = accountMap.get(b.accountCode);
      const debit = b._sum?.debitAmount ?? 0;
      const credit = b._sum?.creditAmount ?? 0;
      return {
        accountCode: b.accountCode,
        accountName: account?.name ?? 'Unknown',
        accountType: account?.accountType ?? 'unknown',
        debit,
        credit,
        balance: debit - credit,
      };
    });
  }

  async getAccountLedger(accountCode: string, startDate?: string, endDate?: string) {
    await this.getAccountByCode(accountCode);

    const where: any = { accountCode };
    if (startDate || endDate) {
      where.journalEntry = {};
      if (startDate) where.journalEntry.entryDate = { gte: new Date(startDate) };
      if (endDate) where.journalEntry.entryDate = { ...where.journalEntry.entryDate, lte: new Date(endDate) };
    }

    const lines = await this.prisma.journalEntryLine.findMany({
      where,
      include: { journalEntry: true },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });

    let runningBalance = 0;
    return lines.map((l) => {
      runningBalance += l.debitAmount - l.creditAmount;
      return {
        date: l.journalEntry.entryDate,
        entryNumber: l.journalEntry.entryNumber,
        description: l.description ?? l.journalEntry.description,
        debit: l.debitAmount,
        credit: l.creditAmount,
        balance: runningBalance,
      };
    });
  }
}