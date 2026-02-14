import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createPaginatedResult, PaginationQueryDto } from '../common';
import { ChartOfAccountsService } from './chart-of-accounts/chart-of-accounts.service';
import { PreventGroupPostingGuard } from './chart-of-accounts/prevent-group-posting.guard';
import { GlEngineService } from './gl-engine/gl-engine.service';
import { TaxEngineService } from './tax/tax-engine.service';
import { GLMapEntry } from './gl-engine/types/gl-map.types';

// Standard account codes - must match prisma/seed.ts chart of accounts
export const ACCOUNT_CODES = {
  // Assets (1xxx)
  CASH: '1110',
  BANK: '1112',
  ACCOUNTS_RECEIVABLE: '1120',
  INVENTORY: '1130',
  
  // Liabilities (2xxx)
  ACCOUNTS_PAYABLE: '2110',
  VAT_PAYABLE: '2120',
  VAT_RECEIVABLE: '1125',
  
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
  INVENTORY_ADJUSTMENT: '5320', // Blueprint 06: stock adjustment expense/income
};

export interface JournalLineInput {
  accountCode?: string;
  accountId?: number;
  debitAmount?: number;
  creditAmount?: number;
  description?: string;
}

@Injectable()
export class AccountingService {
  constructor(
    private prisma: PrismaService,
    private chartOfAccountsService: ChartOfAccountsService,
    private preventGroupPostingGuard: PreventGroupPostingGuard,
    private glEngineService: GlEngineService,
    private taxEngineService: TaxEngineService,
  ) {}

  // ============ GL ENGINE INTEGRATION (Blueprint 02) ============

  private async isGlEngineEnabled(): Promise<boolean> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'gl_engine_enabled' },
    });
    return setting?.value === 'true';
  }

  private async isTaxEngineEnabled(): Promise<boolean> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'tax_engine_enabled' },
    });
    return setting?.value === 'true';
  }

  /** Resolve account codes to IDs - helper for GL Maps */
  private async resolveAccountIds(codes: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const code of codes) {
      const id = await this.chartOfAccountsService.getAccountIdByCode(code);
      if (!id) throw new BadRequestException(`Account not found for code: ${code}`);
      result[code] = id;
    }
    return result;
  }

  /**
   * Get GL Map for sale - used by GL Engine (Blueprint 02)
   * Blueprint 05: When tax_engine_enabled and taxTemplateId: revenue=netTotal, receivable=grandTotal, + VAT Payable
   */
  async getSaleGLMap(
    saleId: number,
    saleNumber: string,
    saleDate: Date,
    branchId: number | null,
    data: {
      totalAmount: number;
      totalCost: number;
      amountPaid: number;
      customerId?: number;
      discountAmount?: number;
      stockAccountCode?: string;
      taxTemplateId?: number;
      netTotal?: number;
      totalTaxAmount?: number;
      grandTotal?: number;
    },
  ): Promise<GLMapEntry[]> {
    const { totalAmount, totalCost, amountPaid, discountAmount } = data;
    const useTax = !!(await this.isTaxEngineEnabled()) && data.taxTemplateId && data.netTotal != null && data.grandTotal != null;
    const receivableTotal = useTax ? data.grandTotal! : totalAmount;
    const revenueAmount = useTax ? data.netTotal! : totalAmount + (discountAmount ?? 0);
    const amountDue = receivableTotal - amountPaid;
    const stockCode = data.stockAccountCode ?? ACCOUNT_CODES.INVENTORY;
    const ids = await this.resolveAccountIds([
      ACCOUNT_CODES.CASH, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, ACCOUNT_CODES.SALES_REVENUE,
      ACCOUNT_CODES.DISCOUNTS_GIVEN, ACCOUNT_CODES.COST_OF_GOODS_SOLD, stockCode,
    ]);
    const entries: GLMapEntry[] = [];
    if (amountPaid > 0) entries.push({ accountId: ids[ACCOUNT_CODES.CASH], debit: amountPaid, description: 'Cash received' });
    if (amountDue > 0 && data.customerId) entries.push({ accountId: ids[ACCOUNT_CODES.ACCOUNTS_RECEIVABLE], debit: amountDue, partyType: 'customer', partyId: data.customerId, description: 'Credit sale' });
    entries.push({ accountId: ids[ACCOUNT_CODES.SALES_REVENUE], credit: revenueAmount, description: 'Sales revenue' });
    if (discountAmount && discountAmount > 0) entries.push({ accountId: ids[ACCOUNT_CODES.DISCOUNTS_GIVEN], debit: discountAmount, description: 'Sales discount' });
    if (useTax && data.taxTemplateId && (data.totalTaxAmount ?? 0) > 0) {
      const taxEntries = await this.taxEngineService.getSalesTaxGLEntries(data.taxTemplateId, data.netTotal!, 2);
      entries.push(...taxEntries);
    }
    entries.push({ accountId: ids[ACCOUNT_CODES.COST_OF_GOODS_SOLD], debit: totalCost, description: 'Cost of goods sold' });
    entries.push({ accountId: ids[stockCode], credit: totalCost, description: 'Inventory reduction' });
    return entries;
  }

  async getSaleVoidGLMap(data: {
    totalAmount: number; totalCost: number; amountPaid: number; discountAmount?: number;
    stockAccountCode?: string; customerId?: number;
    taxTemplateId?: number; netTotal?: number; totalTaxAmount?: number; grandTotal?: number;
  }): Promise<GLMapEntry[]> {
    const { totalAmount, totalCost, amountPaid, discountAmount } = data;
    const useTax = !!(await this.isTaxEngineEnabled()) && data.taxTemplateId && data.netTotal != null && data.grandTotal != null;
    const receivableTotal = useTax ? data.grandTotal! : totalAmount;
    const revenueAmount = useTax ? data.netTotal! : totalAmount + (discountAmount ?? 0);
    const amountDue = receivableTotal - amountPaid;
    const stockCode = data.stockAccountCode ?? ACCOUNT_CODES.INVENTORY;
    const ids = await this.resolveAccountIds([ACCOUNT_CODES.CASH, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, ACCOUNT_CODES.SALES_REVENUE, ACCOUNT_CODES.DISCOUNTS_GIVEN, ACCOUNT_CODES.COST_OF_GOODS_SOLD, stockCode]);
    const entries: GLMapEntry[] = [];
    if (amountPaid > 0) entries.push({ accountId: ids[ACCOUNT_CODES.CASH], credit: amountPaid, description: 'Cash refund' });
    if (amountDue > 0) entries.push({ accountId: ids[ACCOUNT_CODES.ACCOUNTS_RECEIVABLE], credit: amountDue, description: 'Write off receivable' });
    entries.push({ accountId: ids[ACCOUNT_CODES.SALES_REVENUE], debit: revenueAmount, description: 'Sales revenue reversal' });
    if (discountAmount && discountAmount > 0) entries.push({ accountId: ids[ACCOUNT_CODES.DISCOUNTS_GIVEN], credit: discountAmount, description: 'Discount reversal' });
    if (useTax && (data.totalTaxAmount ?? 0) > 0) {
      const taxEntries = await this.taxEngineService.getSalesTaxGLEntries(data.taxTemplateId!, data.netTotal!, 2);
      for (const t of taxEntries) {
        const amt = t.credit ?? 0;
        entries.push({ accountId: t.accountId, debit: amt, description: (t.description ?? 'VAT') + ' reversal' });
      }
    }
    entries.push({ accountId: ids[ACCOUNT_CODES.COST_OF_GOODS_SOLD], credit: totalCost, description: 'COGS reversal' });
    entries.push({ accountId: ids[stockCode], debit: totalCost, description: 'Inventory restoration' });
    return entries;
  }

  async getPurchaseGLMap(data: {
    totalAmount: number; amountPaid: number; stockAccountCode?: string;
    taxTemplateId?: number; netTotal?: number; totalTaxAmount?: number; grandTotal?: number;
  }): Promise<GLMapEntry[]> {
    const { totalAmount, amountPaid } = data;
    const useTax = !!(await this.isTaxEngineEnabled()) && data.taxTemplateId && data.netTotal != null && data.grandTotal != null;
    const payableTotal = useTax ? data.grandTotal! : totalAmount;
    const inventoryAmount = useTax ? data.netTotal! : totalAmount;
    const amountDue = payableTotal - amountPaid;
    const stockCode = data.stockAccountCode ?? ACCOUNT_CODES.INVENTORY;
    const ids = await this.resolveAccountIds([stockCode, ACCOUNT_CODES.CASH, ACCOUNT_CODES.ACCOUNTS_PAYABLE]);
    const entries: GLMapEntry[] = [{ accountId: ids[stockCode], debit: inventoryAmount, description: 'Inventory purchase' }];
    if (useTax && (data.totalTaxAmount ?? 0) > 0) {
      const taxEntries = await this.taxEngineService.getPurchaseTaxGLEntries(data.taxTemplateId!, data.netTotal!, 2);
      entries.push(...taxEntries);
    }
    if (amountPaid > 0) entries.push({ accountId: ids[ACCOUNT_CODES.CASH], credit: amountPaid, description: 'Cash payment' });
    if (amountDue > 0) entries.push({ accountId: ids[ACCOUNT_CODES.ACCOUNTS_PAYABLE], credit: amountDue, description: 'Credit purchase' });
    return entries;
  }

  async getPaymentReceivedGLMap(amount: number): Promise<GLMapEntry[]> {
    const ids = await this.resolveAccountIds([ACCOUNT_CODES.CASH, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE]);
    return [
      { accountId: ids[ACCOUNT_CODES.CASH], debit: amount, description: 'Payment received' },
      { accountId: ids[ACCOUNT_CODES.ACCOUNTS_RECEIVABLE], credit: amount, description: 'Reduce receivable' },
    ];
  }

  async getPaymentMadeGLMap(amount: number): Promise<GLMapEntry[]> {
    const ids = await this.resolveAccountIds([ACCOUNT_CODES.ACCOUNTS_PAYABLE, ACCOUNT_CODES.CASH]);
    return [
      { accountId: ids[ACCOUNT_CODES.ACCOUNTS_PAYABLE], debit: amount, description: 'Pay supplier' },
      { accountId: ids[ACCOUNT_CODES.CASH], credit: amount, description: 'Cash payment' },
    ];
  }

  async getWastageGLMap(amount: number, data?: { stockAccountCode?: string }): Promise<GLMapEntry[]> {
    const stockCode = data?.stockAccountCode ?? ACCOUNT_CODES.INVENTORY;
    const ids = await this.resolveAccountIds([ACCOUNT_CODES.WASTAGE_EXPENSE, stockCode]);
    return [
      { accountId: ids[ACCOUNT_CODES.WASTAGE_EXPENSE], debit: amount, description: 'Wastage expense' },
      { accountId: ids[stockCode], credit: amount, description: 'Inventory loss' },
    ];
  }

  async getExpenseGLMap(amount: number, paymentMethod?: string): Promise<GLMapEntry[]> {
    const ids = await this.resolveAccountIds([ACCOUNT_CODES.OPERATING_EXPENSES, paymentMethod === 'credit' ? ACCOUNT_CODES.ACCOUNTS_PAYABLE : ACCOUNT_CODES.CASH]);
    const creditAccount = paymentMethod === 'credit' ? ACCOUNT_CODES.ACCOUNTS_PAYABLE : ACCOUNT_CODES.CASH;
    return [
      { accountId: ids[ACCOUNT_CODES.OPERATING_EXPENSES], debit: amount, description: 'Operating expense' },
      { accountId: ids[creditAccount], credit: amount, description: paymentMethod === 'credit' ? 'Expense on credit' : 'Cash payment' },
    ];
  }

  async getCreditNoteSaleGLMap(amount: number): Promise<GLMapEntry[]> {
    const ids = await this.resolveAccountIds([ACCOUNT_CODES.DISCOUNTS_GIVEN, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE]);
    return [
      { accountId: ids[ACCOUNT_CODES.DISCOUNTS_GIVEN], debit: amount, description: 'Credit note' },
      { accountId: ids[ACCOUNT_CODES.ACCOUNTS_RECEIVABLE], credit: amount, description: 'Reduce receivable' },
    ];
  }

  async getCreditNotePurchaseGLMap(amount: number): Promise<GLMapEntry[]> {
    const ids = await this.resolveAccountIds([ACCOUNT_CODES.ACCOUNTS_PAYABLE, ACCOUNT_CODES.OTHER_INCOME]);
    return [
      { accountId: ids[ACCOUNT_CODES.ACCOUNTS_PAYABLE], debit: amount, description: 'Credit note' },
      { accountId: ids[ACCOUNT_CODES.OTHER_INCOME], credit: amount, description: 'Purchase credit' },
    ];
  }

  async getInventoryAdjustmentGLMap(data: { adjustmentType: 'increase' | 'decrease'; amount: number; stockAccountCode?: string }): Promise<GLMapEntry[]> {
    const stockCode = data.stockAccountCode ?? ACCOUNT_CODES.INVENTORY;
    const ids = await this.resolveAccountIds([ACCOUNT_CODES.INVENTORY_ADJUSTMENT, stockCode]);
    if (data.adjustmentType === 'decrease') {
      return [
        { accountId: ids[ACCOUNT_CODES.INVENTORY_ADJUSTMENT], debit: data.amount, description: 'Stock adjustment (decrease)' },
        { accountId: ids[stockCode], credit: data.amount, description: 'Inventory reduction' },
      ];
    }
    return [
      { accountId: ids[stockCode], debit: data.amount, description: 'Inventory increase' },
      { accountId: ids[ACCOUNT_CODES.INVENTORY_ADJUSTMENT], credit: data.amount, description: 'Stock adjustment (increase)' },
    ];
  }

  // ============ AUTO JOURNAL ENTRY CREATION ============

  /**
   * Create journal entry for a sale transaction
   * stockAccountCode: optional - use branch-specific stock account (Blueprint 06)
   * Blueprint 02: Uses GL Engine when gl_engine_enabled=true
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
      stockAccountCode?: string;
      saleDate?: Date;
      taxTemplateId?: number;
      netTotal?: number;
      totalTaxAmount?: number;
      grandTotal?: number;
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

    // CR Inventory (Blueprint 06: branch-specific account)
    const stockAccount = data.stockAccountCode ?? ACCOUNT_CODES.INVENTORY;
    lines.push({
      accountCode: stockAccount,
      creditAmount: totalCost,
      description: 'Inventory reduction',
    });

    // Blueprint 02: Use GL Engine when enabled
    if (await this.isGlEngineEnabled()) {
      const postingDate = data.saleDate ?? new Date();
      const glMap = await this.getSaleGLMap(saleId, saleNumber, postingDate, branchId, data);
      return this.glEngineService.post(glMap, {
        voucherType: 'sale',
        voucherId: saleId,
        voucherNumber: saleNumber,
        postingDate,
        companyId: 1,
        branchId,
        description: `بيع: ${saleNumber}`,
        createdById: userId,
      }, tx);
    }

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
   * stockAccountCode: optional - use branch-specific stock account (Blueprint 06)
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
      stockAccountCode?: string;
      customerId?: number;
      taxTemplateId?: number;
      netTotal?: number;
      totalTaxAmount?: number;
      grandTotal?: number;
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

    // DR Inventory (Blueprint 06: branch-specific account)
    const stockAccount = data.stockAccountCode ?? ACCOUNT_CODES.INVENTORY;
    lines.push({
      accountCode: stockAccount,
      debitAmount: totalCost,
      description: 'Inventory restoration',
    });

    if (await this.isGlEngineEnabled()) {
      const glMap = await this.getSaleVoidGLMap({
        totalAmount, totalCost, amountPaid, discountAmount,
        stockAccountCode: data.stockAccountCode, customerId: data.customerId,
        taxTemplateId: data.taxTemplateId, netTotal: data.netTotal,
        totalTaxAmount: data.totalTaxAmount, grandTotal: data.grandTotal,
      });
      return this.glEngineService.post(glMap, {
        voucherType: 'sale_void',
        voucherId: saleId,
        postingDate: new Date(),
        companyId: 1,
        branchId,
        description: `إلغاء بيع: ${saleNumber}`,
        createdById: userId,
      }, tx);
    }
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
   * stockAccountCode: optional - use branch-specific stock account (Blueprint 06)
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
      stockAccountCode?: string;
    },
  ) {
    const lines: JournalLineInput[] = [];
    const { totalAmount, amountPaid } = data;
    const amountDue = totalAmount - amountPaid;

    // DR Inventory (Blueprint 06: branch-specific account)
    const stockAccount = data.stockAccountCode ?? ACCOUNT_CODES.INVENTORY;
    lines.push({
      accountCode: stockAccount,
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

    if (await this.isGlEngineEnabled()) {
      const glMap = await this.getPurchaseGLMap({ totalAmount, amountPaid, stockAccountCode: data.stockAccountCode });
      return this.glEngineService.post(glMap, {
        voucherType: 'purchase',
        voucherId: purchaseId,
        voucherNumber: purchaseNumber,
        postingDate: new Date(),
        companyId: 1,
        branchId,
        description: `شراء: ${purchaseNumber}`,
        createdById: userId,
      }, tx);
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
   * Create journal entry for inventory adjustment (Blueprint 06)
   * Decrease: DR Inventory Adjustment (5320), CR Stock
   * Increase: DR Stock, CR Inventory Adjustment (5320)
   */
  async createInventoryAdjustmentJournalEntry(
    tx: any,
    adjustmentId: number,
    branchId: number | null,
    userId: number,
    data: {
      adjustmentType: 'increase' | 'decrease';
      amount: number;
      stockAccountCode?: string;
    },
  ) {
    const stockAccount = data.stockAccountCode ?? ACCOUNT_CODES.INVENTORY;
    const lines: JournalLineInput[] = [];
    if (data.adjustmentType === 'decrease') {
      lines.push(
        { accountCode: ACCOUNT_CODES.INVENTORY_ADJUSTMENT, debitAmount: data.amount, description: 'Stock adjustment (decrease)' },
        { accountCode: stockAccount, creditAmount: data.amount, description: 'Inventory reduction' },
      );
    } else {
      lines.push(
        { accountCode: stockAccount, debitAmount: data.amount, description: 'Inventory increase' },
        { accountCode: ACCOUNT_CODES.INVENTORY_ADJUSTMENT, creditAmount: data.amount, description: 'Stock adjustment (increase)' },
      );
    }
    if (await this.isGlEngineEnabled()) {
      const glMap = await this.getInventoryAdjustmentGLMap({ adjustmentType: data.adjustmentType, amount: data.amount, stockAccountCode: data.stockAccountCode });
      return this.glEngineService.post(glMap, {
        voucherType: 'adjustment',
        voucherId: adjustmentId,
        postingDate: new Date(),
        companyId: 1,
        branchId,
        description: `تعديل مخزون #${adjustmentId}`,
        createdById: userId,
      }, tx);
    }
    return this.createJournalEntryInternal(tx, {
      description: `تعديل مخزون #${adjustmentId}`,
      sourceType: 'adjustment',
      sourceId: adjustmentId,
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

    if (await this.isGlEngineEnabled()) {
      const glMap = await this.getPaymentReceivedGLMap(amount);
      return this.glEngineService.post(glMap, {
        voucherType: 'payment',
        voucherId: paymentId,
        voucherNumber: paymentNumber,
        postingDate: new Date(),
        companyId: 1,
        branchId,
        description: `تحصيل: ${paymentNumber}`,
        createdById: userId,
      }, tx);
    }
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

    if (await this.isGlEngineEnabled()) {
      const glMap = await this.getPaymentMadeGLMap(amount);
      return this.glEngineService.post(glMap, {
        voucherType: 'payment',
        voucherId: paymentId,
        voucherNumber: paymentNumber,
        postingDate: new Date(),
        companyId: 1,
        branchId,
        description: `دفع: ${paymentNumber}`,
        createdById: userId,
      }, tx);
    }
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
   * Blueprint 04: Credit Note against Sale - reduces AR and revenue
   */
  async createCreditNoteSaleJournalEntry(
    tx: any,
    creditNoteId: number,
    creditNoteNumber: string,
    branchId: number | null,
    userId: number,
    amount: number,
  ) {
    const lines: JournalLineInput[] = [
      { accountCode: ACCOUNT_CODES.DISCOUNTS_GIVEN, debitAmount: amount, description: 'Credit note' },
      { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, creditAmount: amount, description: 'Reduce receivable' },
    ];
    if (await this.isGlEngineEnabled()) {
      const glMap = await this.getCreditNoteSaleGLMap(amount);
      return this.glEngineService.post(glMap, {
        voucherType: 'credit_note',
        voucherId: creditNoteId,
        voucherNumber: creditNoteNumber,
        postingDate: new Date(),
        companyId: 1,
        branchId,
        description: `إشعار دائن: ${creditNoteNumber}`,
        createdById: userId,
      }, tx);
    }
    return this.createJournalEntryInternal(tx, {
      description: `إشعار دائن: ${creditNoteNumber}`,
      sourceType: 'credit_note',
      sourceId: creditNoteId,
      branchId,
      lines,
      userId,
      autoPost: true,
    });
  }

  /**
   * Blueprint 04: Credit Note against Purchase - reduces AP
   */
  async createCreditNotePurchaseJournalEntry(
    tx: any,
    creditNoteId: number,
    creditNoteNumber: string,
    branchId: number | null,
    userId: number,
    amount: number,
  ) {
    const lines: JournalLineInput[] = [
      { accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE, debitAmount: amount, description: 'Credit note' },
      { accountCode: ACCOUNT_CODES.OTHER_INCOME, creditAmount: amount, description: 'Purchase credit' },
    ];
    if (await this.isGlEngineEnabled()) {
      const glMap = await this.getCreditNotePurchaseGLMap(amount);
      return this.glEngineService.post(glMap, {
        voucherType: 'credit_note',
        voucherId: creditNoteId,
        voucherNumber: creditNoteNumber,
        postingDate: new Date(),
        companyId: 1,
        branchId,
        description: `إشعار دائن شراء: ${creditNoteNumber}`,
        createdById: userId,
      }, tx);
    }
    return this.createJournalEntryInternal(tx, {
      description: `إشعار دائن شراء: ${creditNoteNumber}`,
      sourceType: 'credit_note',
      sourceId: creditNoteId,
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

    if (await this.isGlEngineEnabled()) {
      const glMap = await this.getWastageGLMap(amount);
      return this.glEngineService.post(glMap, {
        voucherType: 'wastage',
        voucherId: wastageId,
        postingDate: new Date(),
        companyId: 1,
        branchId,
        description: 'هدر مخزون',
        createdById: userId,
      }, tx);
    }
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

    if (await this.isGlEngineEnabled()) {
      const glMap = await this.getExpenseGLMap(amount, paymentMethod);
      return this.glEngineService.post(glMap, {
        voucherType: 'expense',
        voucherId: expenseId,
        voucherNumber: expenseNumber,
        postingDate: new Date(),
        companyId: 1,
        branchId,
        description: `مصروف: ${expenseNumber}`,
        createdById: userId,
      }, tx);
    }
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
   * Blueprint 01: Uses accountId, validates via PreventGroupPostingGuard
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
    const linesWithIds = await this.resolveLinesToAccountIds(params.lines);
    const accountIds = linesWithIds.map((l) => l.accountId).filter(Boolean);
    await this.preventGroupPostingGuard.validateAccountsForPosting(accountIds);

    const totalDebit = linesWithIds.reduce((sum, l) => sum + (l.debitAmount ?? 0), 0);
    const totalCredit = linesWithIds.reduce((sum, l) => sum + (l.creditAmount ?? 0), 0);

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

    for (let i = 0; i < linesWithIds.length; i++) {
      const line = linesWithIds[i];
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: entry.id,
          lineNumber: i + 1,
          accountId: line.accountId,
          debitAmount: line.debitAmount ?? 0,
          creditAmount: line.creditAmount ?? 0,
          description: line.description,
        },
      });
    }

    return entry;
  }

  private async resolveLinesToAccountIds(
    lines: JournalLineInput[],
  ): Promise<Array<{ accountId: number; debitAmount?: number; creditAmount?: number; description?: string }>> {
    const result: Array<{ accountId: number; debitAmount?: number; creditAmount?: number; description?: string }> = [];
    for (const line of lines) {
      let accountId = line.accountId;
      if (!accountId && line.accountCode) {
        const id = await this.chartOfAccountsService.getAccountIdByCode(line.accountCode);
        if (!id) throw new BadRequestException(`Account not found for code: ${line.accountCode}`);
        accountId = id;
      }
      if (!accountId) throw new BadRequestException('Each line must have accountId or accountCode');
      result.push({
        accountId,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        description: line.description,
      });
    }
    return result;
  }

  private async generateEntryNumberTx(tx: any): Promise<string> {
    const count = await tx.journalEntry.count();
    return `JE-${(count + 1).toString().padStart(6, '0')}`;
  }

  // ============ REVERSE BY VOUCHER (Blueprint 03) ============

  /**
   * Reverse GL entries for a voucher (payment, sale, etc.).
   * Blueprint 02: Uses GlEngineService.reverse when gl_engine_enabled
   */
  async reverseByVoucher(
    voucherType: string,
    voucherId: number,
    userId: number,
    tx?: any,
  ) {
    if (await this.isGlEngineEnabled()) {
      return this.glEngineService.reverse(voucherType, voucherId, userId, tx);
    }
    const executor = tx ?? this.prisma;
    const original = await executor.journalEntry.findFirst({
      where: { sourceType: voucherType, sourceId: voucherId },
      include: { lines: true },
    });

    if (!original) {
      throw new NotFoundException({
        code: 'JOURNAL_ENTRY_NOT_FOUND',
        message: `No journal entry found for ${voucherType} #${voucherId}`,
        messageAr: 'لم يُعثر على قيد محاسبي لهذا المستند',
      });
    }

    if (original.isReversed) {
      throw new BadRequestException({
        code: 'ALREADY_REVERSED',
        message: 'Journal entry is already reversed',
        messageAr: 'القيد معكوس بالفعل',
      });
    }

    const reversalLines: JournalLineInput[] = original.lines.map((l: { accountId: number; debitAmount: number; creditAmount: number; description?: string | null }) => ({
      accountId: l.accountId,
      debitAmount: l.creditAmount,
      creditAmount: l.debitAmount,
      description: `عكس: ${l.description ?? original.description}`,
    }));

    const reversal = await this.createJournalEntryInternal(executor, {
      description: `عكس: ${original.description}`,
      sourceType: 'reversal',
      sourceId: original.id,
      branchId: original.branchId,
      lines: reversalLines,
      userId,
      autoPost: true,
    });

    await executor.journalEntry.update({
      where: { id: original.id },
      data: { isReversed: true, reversedByEntryId: reversal.id },
    });

    return reversal;
  }

  // ============ JOURNAL ENTRIES ============

  async getJournalEntries(pagination: PaginationQueryDto) {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const [entries, totalItems] = await Promise.all([
      this.prisma.journalEntry.findMany({
        skip,
        take: pageSize,
        include: { lines: { include: { account: true, costCenter: true } }, createdBy: true },
        orderBy: { entryDate: 'desc' },
      }),
      this.prisma.journalEntry.count(),
    ]);

    return createPaginatedResult(entries, page, pageSize, totalItems);
  }

  async getJournalEntryById(id: number) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { account: true, costCenter: true } }, createdBy: true },
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
    const glMap: GLMapEntry[] = dto.lines.map((l: any) => ({
      accountId: l.accountId,
      debit: l.debit ?? l.debitAmount ?? 0,
      credit: l.credit ?? l.creditAmount ?? 0,
      description: l.description,
    }));

    if (await this.isGlEngineEnabled()) {
      const entry = await this.glEngineService.post(glMap, {
        voucherType: dto.sourceType ?? 'journal_entry',
        voucherId: dto.sourceId ?? 0,
        postingDate: dto.entryDate ? new Date(dto.entryDate) : new Date(),
        companyId: 1,
        branchId: dto.branchId ?? null,
        description: dto.description,
        createdById: userId,
      });
      return this.getJournalEntryById(entry.id);
    }

    const lines: JournalLineInput[] = dto.lines.map((l: any) => ({
      accountId: l.accountId,
      debitAmount: l.debit ?? l.debitAmount,
      creditAmount: l.credit ?? l.creditAmount,
      description: l.description,
    }));
    const accountIds = lines.map((l) => l.accountId).filter((id): id is number => id != null);
    await this.preventGroupPostingGuard.validateAccountsForPosting(accountIds);

    const totalDebit = lines.reduce((sum: number, l: any) => sum + (l.debitAmount ?? 0), 0);
    const totalCredit = lines.reduce((sum: number, l: any) => sum + (l.creditAmount ?? 0), 0);

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

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: entry.id,
            lineNumber: i + 1,
            accountId: line.accountId!,
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
      const reversal = await this.createJournalEntry(
        {
          description: `عكس: ${entry.description}`,
          sourceType: 'adjustment',
          lines: entry.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.creditAmount,
            credit: l.debitAmount,
          })),
        },
        userId,
      );

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
      by: ['accountId'],
      where: dateFilter
        ? { journalEntry: { entryDate: dateFilter, isPosted: true } }
        : { journalEntry: { isPosted: true } },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const accountIds = grouped.map((g) => g.accountId);
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds } },
    });

    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    return grouped.map((b) => {
      const account = accountMap.get(b.accountId);
      const debit = b._sum?.debitAmount ?? 0;
      const credit = b._sum?.creditAmount ?? 0;
      return {
        accountId: b.accountId,
        accountCode: account?.code ?? 'Unknown',
        accountName: account?.name ?? 'Unknown',
        accountType: account?.accountType ?? 'unknown',
        debit,
        credit,
        balance: debit - credit,
      };
    });
  }

  async getAccountLedger(accountIdOrCode: number | string, startDate?: string, endDate?: string) {
    let accountId: number;
    if (typeof accountIdOrCode === 'number') {
      accountId = accountIdOrCode;
    } else {
      const id = await this.chartOfAccountsService.getAccountIdByCode(accountIdOrCode);
      if (!id) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Account not found', messageAr: 'الحساب غير موجود' });
      accountId = id;
    }

    const where: Record<string, unknown> = { accountId };
    if (startDate || endDate) {
      const entryDate: Record<string, Date> = {};
      if (startDate) entryDate.gte = new Date(startDate);
      if (endDate) entryDate.lte = new Date(endDate);
      where.journalEntry = { entryDate };
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