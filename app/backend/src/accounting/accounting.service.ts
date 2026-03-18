import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createPaginatedResult, PaginationQueryDto } from '../common';
import { ChartOfAccountsService } from './chart-of-accounts/chart-of-accounts.service';
import { AccountRepository } from './chart-of-accounts/account.repository';
import { PreventGroupPostingGuard } from './chart-of-accounts/prevent-group-posting.guard';
import { GlEngineService } from './gl-engine/gl-engine.service';
import { TaxEngineService } from './tax/tax-engine.service';
import { GLMapEntry } from './gl-engine/types/gl-map.types';
import { PdfService } from '../pdf/pdf.service';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { PdfSection, PdfSectionItem, BalanceSheetPdfData, BalanceSheetSection, BalanceSheetRow } from '../pdf/pdf.types';
import { buildFinancialStatementPdfOptions } from '../pdf/templates/financial-statement.template';
import { buildReportPdfOptions } from '../pdf/templates/report.template';
import { formatDateForHeader } from '../pdf/pdf.helpers';
import { DESCRIPTION_AR, SOURCE_TYPE_AR } from './ledger-localization';

// Standard account codes - must match prisma/seed.ts chart of accounts
export const ACCOUNT_CODES = {
  // Assets (1xxx)
  CASH: '1111',               // Cash in Drawer (Postable)
  BANK: '1112',
  ACCOUNTS_RECEIVABLE: '1120',
  INVENTORY: '1131',          // Fresh Chicken Inventory (Postable)

  // Liabilities (2xxx)
  ACCOUNTS_PAYABLE: '2110',
  VAT_PAYABLE: '2120',
  VAT_RECEIVABLE: '1125',

  // Equity (3xxx)
  CAPITAL: '3100',
  RETAINED_EARNINGS: '3200',

  // Revenue (4xxx)
  SALES_REVENUE: '4110',      // Fresh Chicken Sales (Postable)
  OTHER_INCOME: '4200',

  // Expenses (5xxx)
  COST_OF_GOODS_SOLD: '5100',
  OPERATING_EXPENSES: '5400', // Other Expenses (Postable)
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
    private pdfService: PdfService,
  ) { }

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

  /** Resolve cash (1111) or bank account for payments - used when paymentMethod is bank_transfer/card and bankAccountId is set */
  private async resolveCashOrBankAccount(
    paymentMethod?: string,
    bankAccountId?: number | null,
    tx?: any,
  ): Promise<number> {
    const prisma = tx ?? this.prisma;
    if (paymentMethod && ['bank_transfer', 'card'].includes(paymentMethod)) {
      let resolvedBankId = bankAccountId;
      if (!resolvedBankId) {
        let fallback = await prisma.bankAccount.findFirst({
          where: { isDefault: true, isActive: true, companyId: 1 },
          select: { id: true },
        });
        if (!fallback) {
          fallback = await prisma.bankAccount.findFirst({
            where: { isActive: true, companyId: 1 },
            select: { id: true },
            orderBy: { id: 'asc' },
          });
        }
        resolvedBankId = fallback?.id ?? null;
      }
      if (resolvedBankId) {
        const bank = await prisma.bankAccount.findUnique({
          where: { id: resolvedBankId },
          select: { accountId: true, name: true },
        });
        if (bank) return bank.accountId;
        throw new BadRequestException({
          code: 'BANK_ACCOUNT_NOT_FOUND',
          message: `Bank account #${resolvedBankId} not found`,
          messageAr: 'الحساب البنكي المحدد غير موجود',
        });
      }
      // عند تحويل بنكي/بطاقة بدون بنك محدد: لا نعود للصندوق بصمت — نرمي خطأ
      const bankCount = await prisma.bankAccount.count({ where: { isActive: true, companyId: 1 } });
      if (bankCount > 0) {
        throw new BadRequestException({
          code: 'BANK_ACCOUNT_REQUIRED',
          message: 'Bank account must be selected for bank transfer or card payment',
          messageAr: 'يجب اختيار البنك عند الدفع بالتحويل البنكي أو البطاقة',
        });
      }
    }
    const id = await this.chartOfAccountsService.getAccountIdByCode(ACCOUNT_CODES.CASH);
    if (!id) throw new BadRequestException({
      code: 'ACCOUNT_NOT_FOUND',
      message: `Account not found for code: ${ACCOUNT_CODES.CASH}`,
      messageAr: `الحساب المحاسبي غير موجود`,
    });
    return id;
  }

  /** Resolve account codes to IDs - helper for GL Maps */
  private async resolveAccountIds(codes: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const code of codes) {
      const id = await this.chartOfAccountsService.getAccountIdByCode(code);
      if (!id) throw new BadRequestException({
        code: 'ACCOUNT_NOT_FOUND',
        message: `Account not found for code: ${code}`,
        messageAr: `الحساب المحاسبي غير موجود: كود ${code} — تحقق من دليل الحسابات`,
      });
      result[code] = id;
    }
    return result;
  }

  /**
   * Get account balance (debit - credit) as of a date.
   * For asset accounts (cash, bank), positive balance = funds available.
   */
  async getAccountBalance(
    accountIdOrCode: number | string,
    asOfDate?: Date,
    tx?: any,
  ): Promise<number> {
    const prisma = tx ?? this.prisma;
    let accountId: number;
    if (typeof accountIdOrCode === 'number') {
      accountId = accountIdOrCode;
    } else {
      const id = await this.chartOfAccountsService.getAccountIdByCode(accountIdOrCode);
      if (!id) throw new BadRequestException({
        code: 'ACCOUNT_NOT_FOUND',
        message: `Account not found for code: ${accountIdOrCode}`,
        messageAr: `الحساب المحاسبي غير موجود`,
      });
      accountId = id;
    }

    const where: Record<string, unknown> = {
      accountId,
      journalEntry: { isPosted: true },
    };
    if (asOfDate) {
      // Include full day: set to end of day so entries on asOfDate are counted (matches getAccountLedger)
      const endOfDay = new Date(asOfDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      (where.journalEntry as Record<string, unknown>).entryDate = { lte: endOfDay };
    }

    const agg = await prisma.journalEntryLine.aggregate({
      where,
      _sum: { debitAmount: true, creditAmount: true },
    });
    const debit = agg._sum?.debitAmount ?? 0;
    const credit = agg._sum?.creditAmount ?? 0;
    return debit - credit;
  }

  /**
   * Resolve cash or bank account and get its balance. Used before payment operations.
   */
  async getCashOrBankBalance(
    paymentMethod: string,
    bankAccountId?: number | null,
    asOfDate?: Date,
    tx?: any,
  ): Promise<{ accountId: number; balance: number; accountName: string }> {
    const accountId = await this.resolveCashOrBankAccount(paymentMethod, bankAccountId, tx);
    const balance = await this.getAccountBalance(accountId, asOfDate, tx);
    const prisma = tx ?? this.prisma;
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { name: true },
    });
    return {
      accountId,
      balance,
      accountName: account?.name ?? 'Unknown',
    };
  }

  /**
   * Throw INSUFFICIENT_BALANCE if the cash/bank account does not have enough balance for the payment.
   * Only call for outflow operations (purchase payment, supplier payment, expense).
   */
  async assertSufficientBalance(
    amount: number,
    paymentMethod: string,
    bankAccountId?: number | null,
    asOfDate?: Date,
    tx?: any,
  ): Promise<void> {
    if (amount <= 0) return;
    const { balance, accountName } = await this.getCashOrBankBalance(paymentMethod, bankAccountId, asOfDate, tx);
    if (balance < amount) {
      const fmt = (n: number) => (n / 100).toFixed(2);
      const shortfall = (amount - balance) / 100;
      const hintAr =
        paymentMethod === 'cash'
          ? ' يمكنك استخدام تحويل بنكي أو بطاقة إذا كان رصيد البنك كافياً، أو تسجيل الشراء آجلاً (بدون دفع فوري).'
          : ' يمكنك اختيار حساب بنكي آخر أو تسجيل الشراء آجلاً.';
      const hintEn =
        paymentMethod === 'cash'
          ? ' Use bank transfer or card if balance suffices, or record as credit purchase.'
          : ' Choose another bank account or record as credit purchase.';
      throw new BadRequestException({
        code: 'INSUFFICIENT_BALANCE',
        message: `Insufficient balance in ${accountName}. Available: ${fmt(balance)} ₪, required: ${fmt(amount)} ₪. Shortfall: ${shortfall.toFixed(2)} ₪.${hintEn}`,
        messageAr: `الرصيد غير كافٍ في ${accountName}. المتاح: ${fmt(balance)} ₪، المطلوب: ${fmt(amount)} ₪. النقص: ${shortfall.toFixed(2)} ₪.${hintAr}`,
      });
    }
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
      paymentMethod?: string;
      bankAccountId?: number | null;
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
    const cashOrBankId = amountPaid > 0
      ? await this.resolveCashOrBankAccount(data.paymentMethod, data.bankAccountId)
      : ids[ACCOUNT_CODES.CASH];
    const isBank = amountPaid > 0 && cashOrBankId !== ids[ACCOUNT_CODES.CASH];
    const entries: GLMapEntry[] = [];
    if (amountPaid > 0) entries.push({ accountId: cashOrBankId, debit: amountPaid, partyType: data.customerId ? 'customer' : undefined, partyId: data.customerId, description: isBank ? 'Bank received' : 'Cash received' });
    if (amountDue > 0) entries.push({ accountId: ids[ACCOUNT_CODES.ACCOUNTS_RECEIVABLE], debit: amountDue, partyType: data.customerId ? 'customer' : undefined, partyId: data.customerId, description: data.customerId ? 'Credit sale' : 'Partial payment - balance due' });
    entries.push({ accountId: ids[ACCOUNT_CODES.SALES_REVENUE], credit: revenueAmount, partyType: data.customerId ? 'customer' : undefined, partyId: data.customerId, description: 'Sales revenue' });
    if (discountAmount && discountAmount > 0) entries.push({ accountId: ids[ACCOUNT_CODES.DISCOUNTS_GIVEN], debit: discountAmount, partyType: data.customerId ? 'customer' : undefined, partyId: data.customerId, description: 'Sales discount' });
    if (useTax && data.taxTemplateId && (data.totalTaxAmount ?? 0) > 0) {
      const taxEntries = await this.taxEngineService.getSalesTaxGLEntries(data.taxTemplateId, data.netTotal!, 2);
      // Optional: attach party to tax entries too if needed
      entries.push(...taxEntries.map(e => ({ ...e, partyType: data.customerId ? 'customer' as const : undefined, partyId: data.customerId })));
    }
    entries.push({ accountId: ids[ACCOUNT_CODES.COST_OF_GOODS_SOLD], debit: totalCost, partyType: data.customerId ? 'customer' : undefined, partyId: data.customerId, description: 'Cost of goods sold' });
    entries.push({ accountId: ids[stockCode], credit: totalCost, description: 'Inventory reduction' });
    return entries;
  }

  async getSaleVoidGLMap(data: {
    totalAmount: number; totalCost: number; amountPaid: number; discountAmount?: number;
    stockAccountCode?: string; customerId?: number;
    taxTemplateId?: number; netTotal?: number; totalTaxAmount?: number; grandTotal?: number;
    paymentMethod?: string; bankAccountId?: number | null;
  }): Promise<GLMapEntry[]> {
    const { totalAmount, totalCost, amountPaid, discountAmount } = data;
    const useTax = !!(await this.isTaxEngineEnabled()) && data.taxTemplateId && data.netTotal != null && data.grandTotal != null;
    const receivableTotal = useTax ? data.grandTotal! : totalAmount;
    const revenueAmount = useTax ? data.netTotal! : totalAmount + (discountAmount ?? 0);
    const amountDue = receivableTotal - amountPaid;
    const stockCode = data.stockAccountCode ?? ACCOUNT_CODES.INVENTORY;
    const ids = await this.resolveAccountIds([ACCOUNT_CODES.CASH, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, ACCOUNT_CODES.SALES_REVENUE, ACCOUNT_CODES.DISCOUNTS_GIVEN, ACCOUNT_CODES.COST_OF_GOODS_SOLD, stockCode]);
    const cashOrBankId = amountPaid > 0
      ? await this.resolveCashOrBankAccount(data.paymentMethod ?? 'cash', data.bankAccountId)
      : ids[ACCOUNT_CODES.CASH];
    const entries: GLMapEntry[] = [];
    if (amountPaid > 0) entries.push({ accountId: cashOrBankId, credit: amountPaid, description: 'Payment refund' });
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
    totalAmount: number; amountPaid: number; supplierId?: number; stockAccountCode?: string;
    taxTemplateId?: number; netTotal?: number; totalTaxAmount?: number; grandTotal?: number;
    paymentMethod?: string; bankAccountId?: number | null;
  }): Promise<GLMapEntry[]> {
    const { totalAmount, amountPaid, supplierId } = data;
    const useTax = !!(await this.isTaxEngineEnabled()) && data.taxTemplateId && data.netTotal != null && data.grandTotal != null;
    const payableTotal = useTax ? data.grandTotal! : totalAmount;
    const inventoryAmount = useTax ? data.netTotal! : totalAmount;
    const amountDue = payableTotal - amountPaid;
    const stockCode = data.stockAccountCode ?? ACCOUNT_CODES.INVENTORY;
    const ids = await this.resolveAccountIds([stockCode, ACCOUNT_CODES.CASH, ACCOUNT_CODES.ACCOUNTS_PAYABLE]);
    const cashOrBankId = amountPaid > 0
      ? await this.resolveCashOrBankAccount(data.paymentMethod ?? 'cash', data.bankAccountId)
      : ids[ACCOUNT_CODES.CASH];
    const entries: GLMapEntry[] = [{ accountId: ids[stockCode], debit: inventoryAmount, partyType: supplierId ? 'supplier' : undefined, partyId: supplierId, description: 'Inventory purchase' }];
    if (useTax && (data.totalTaxAmount ?? 0) > 0) {
      const taxEntries = await this.taxEngineService.getPurchaseTaxGLEntries(data.taxTemplateId!, data.netTotal!, 2);
      entries.push(...taxEntries.map(e => ({ ...e, partyType: supplierId ? 'supplier' as const : undefined, partyId: supplierId })));
    }
    if (amountPaid > 0) entries.push({ accountId: cashOrBankId, credit: amountPaid, partyType: supplierId ? 'supplier' : undefined, partyId: supplierId, description: 'Payment made' });
    if (amountDue > 0) entries.push({ accountId: ids[ACCOUNT_CODES.ACCOUNTS_PAYABLE], credit: amountDue, partyType: supplierId ? 'supplier' : undefined, partyId: supplierId, description: 'Credit purchase' });
    return entries;
  }

  async getPaymentReceivedGLMap(amount: number, paymentMethod?: string, bankAccountId?: number | null): Promise<GLMapEntry[]> {
    const ids = await this.resolveAccountIds([ACCOUNT_CODES.CASH, ACCOUNT_CODES.ACCOUNTS_RECEIVABLE]);
    const cashOrBankId = await this.resolveCashOrBankAccount(paymentMethod ?? 'cash', bankAccountId);
    return [
      { accountId: cashOrBankId, debit: amount, description: 'Payment received' },
      { accountId: ids[ACCOUNT_CODES.ACCOUNTS_RECEIVABLE], credit: amount, description: 'Reduce receivable' },
    ];
  }

  async getPaymentMadeGLMap(amount: number, paymentMethod?: string, bankAccountId?: number | null): Promise<GLMapEntry[]> {
    const ids = await this.resolveAccountIds([ACCOUNT_CODES.ACCOUNTS_PAYABLE, ACCOUNT_CODES.CASH]);
    const cashOrBankId = await this.resolveCashOrBankAccount(paymentMethod ?? 'cash', bankAccountId);
    return [
      { accountId: ids[ACCOUNT_CODES.ACCOUNTS_PAYABLE], debit: amount, description: 'Pay supplier' },
      { accountId: cashOrBankId, credit: amount, description: 'Payment made' },
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

  async getExpenseGLMap(amount: number, paymentMethod?: string, bankAccountId?: number | null): Promise<GLMapEntry[]> {
    if (paymentMethod === 'credit') {
      const ids = await this.resolveAccountIds([ACCOUNT_CODES.OPERATING_EXPENSES, ACCOUNT_CODES.ACCOUNTS_PAYABLE]);
      return [
        { accountId: ids[ACCOUNT_CODES.OPERATING_EXPENSES], debit: amount, description: 'Operating expense' },
        { accountId: ids[ACCOUNT_CODES.ACCOUNTS_PAYABLE], credit: amount, description: 'Expense on credit' },
      ];
    }
    const ids = await this.resolveAccountIds([ACCOUNT_CODES.OPERATING_EXPENSES, ACCOUNT_CODES.CASH]);
    const cashOrBankId = await this.resolveCashOrBankAccount(paymentMethod ?? 'cash', bankAccountId);
    return [
      { accountId: ids[ACCOUNT_CODES.OPERATING_EXPENSES], debit: amount, description: 'Operating expense' },
      { accountId: cashOrBankId, credit: amount, description: paymentMethod === 'bank_transfer' ? 'Bank payment' : 'Cash payment' },
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
      paymentMethod?: string;
      bankAccountId?: number | null;
    },
  ) {
    const lines: JournalLineInput[] = [];
    const { totalAmount, totalCost, amountPaid, discountAmount } = data;
    const amountDue = totalAmount - amountPaid;

    // Revenue side
    // DR Cash or Bank (amount paid) - resolve based on paymentMethod and bankAccountId
    if (amountPaid > 0) {
      const cashOrBankAccountId = await this.resolveCashOrBankAccount(data.paymentMethod, data.bankAccountId, tx);
      const cashAccountId = await this.chartOfAccountsService.getAccountIdByCode(ACCOUNT_CODES.CASH);
      const isBank = cashOrBankAccountId !== cashAccountId;
      lines.push({
        accountId: cashOrBankAccountId,
        debitAmount: amountPaid,
        description: isBank ? 'Bank received' : 'Cash received',
      });
    }

    // DR Accounts Receivable (amount due) - always record when there's balance due for correct double-entry
    if (amountDue > 0) {
      lines.push({
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmount: amountDue,
        description: data.customerId ? 'Credit sale' : 'Partial payment - balance due',
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
      paymentMethod?: string;
      bankAccountId?: number | null;
    },
  ) {
    const lines: JournalLineInput[] = [];
    const { totalAmount, totalCost, amountPaid, discountAmount } = data;
    const amountDue = totalAmount - amountPaid;

    // Reverse revenue side
    // CR Cash or Bank (refund) - resolve based on paymentMethod and bankAccountId
    if (amountPaid > 0) {
      const cashOrBankAccountId = await this.resolveCashOrBankAccount(data.paymentMethod, data.bankAccountId, tx);
      const cashAccountId = await this.chartOfAccountsService.getAccountIdByCode(ACCOUNT_CODES.CASH);
      const isBank = cashOrBankAccountId !== cashAccountId;
      lines.push({
        accountId: cashOrBankAccountId,
        creditAmount: amountPaid,
        description: isBank ? 'Bank refund' : 'Cash refund',
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
        paymentMethod: data.paymentMethod, bankAccountId: data.bankAccountId,
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
      supplierId?: number;
      stockAccountCode?: string;
      paymentMethod?: string;
      bankAccountId?: number | null;
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

    // CR Cash or Bank (if paid) - use selected bank when paymentMethod is bank_transfer/card
    if (amountPaid > 0) {
      const paymentAccountId = await this.resolveCashOrBankAccount(
        data.paymentMethod ?? 'cash',
        data.bankAccountId ?? null,
        tx,
      );
      const isBank = data.paymentMethod === 'bank_transfer' || data.paymentMethod === 'card';
      lines.push({
        accountId: paymentAccountId,
        creditAmount: amountPaid,
        description: isBank ? 'Bank payment' : 'Cash payment',
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
      const glMap = await this.getPurchaseGLMap({
        totalAmount,
        amountPaid,
        supplierId: data.supplierId,
        stockAccountCode: data.stockAccountCode,
        paymentMethod: data.paymentMethod,
        bankAccountId: data.bankAccountId,
      });
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
    paymentMethod?: string,
    bankAccountId?: number | null,
  ) {
    const cashOrBankAccountId = await this.resolveCashOrBankAccount(paymentMethod ?? 'cash', bankAccountId, tx);
    const lines: JournalLineInput[] = [
      {
        accountId: cashOrBankAccountId,
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
      const glMap = await this.getPaymentReceivedGLMap(amount, paymentMethod, bankAccountId);
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
    paymentMethod?: string,
    bankAccountId?: number | null,
  ) {
    const cashOrBankAccountId = await this.resolveCashOrBankAccount(paymentMethod ?? 'cash', bankAccountId, tx);
    const lines: JournalLineInput[] = [
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
        debitAmount: amount,
        description: 'Pay supplier',
      },
      {
        accountId: cashOrBankAccountId,
        creditAmount: amount,
        description: 'Cash payment',
      },
    ];

    if (await this.isGlEngineEnabled()) {
      const glMap = await this.getPaymentMadeGLMap(amount, paymentMethod, bankAccountId);
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
    bankAccountId?: number | null,
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
      const glMap = await this.getExpenseGLMap(amount, paymentMethod, bankAccountId);
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
    await this.preventGroupPostingGuard.validateAccountPostingSides(linesWithIds);

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
        if (!id) throw new BadRequestException({
          code: 'ACCOUNT_NOT_FOUND',
          message: `Account not found for code: ${line.accountCode}`,
          messageAr: `الحساب المحاسبي غير موجود: كود ${line.accountCode} — تحقق من دليل الحسابات`,
        });
        accountId = id;
      }
      if (!accountId) throw new BadRequestException({
        code: 'ACCOUNT_MISSING',
        message: 'Each line must have accountId or accountCode',
        messageAr: 'كل سطر في القيد يجب أن يحتوي على حساب محاسبي',
      });
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
    // Avoid count-based numbering because deleted rows create gaps and can cause duplicates.
    let nextNumber = (await tx.journalEntry.count()) + 1;

    for (let attempts = 0; attempts < 100000; attempts++) {
      const candidate = `JE-${nextNumber.toString().padStart(6, '0')}`;
      const exists = await tx.journalEntry.findUnique({
        where: { entryNumber: candidate },
        select: { id: true },
      });

      if (!exists) return candidate;
      nextNumber += 1;
    }

    throw new InternalServerErrorException({
      code: 'ENTRY_NUMBER_GENERATION_FAILED',
      message: 'Unable to generate a unique journal entry number',
      messageAr: 'تعذر إنشاء رقم قيد محاسبي فريد',
    });
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

    const sourcePartyMap = await this.resolveSourcePartyForEntries(entries.map(e => ({ id: e.id, sourceType: e.sourceType, sourceId: e.sourceId })));
    const enriched = entries.map((e) => {
      const sp = sourcePartyMap.get(e.id);
      return {
        ...e,
        sourcePartyName: sp?.sourcePartyName ?? null,
        sourcePartyType: sp?.sourcePartyType ?? null,
        sourceExpenseCategoryName: sp?.sourceExpenseCategoryName ?? null,
      };
    });

    return createPaginatedResult(enriched, page, pageSize, totalItems);
  }

  /** جلب الطرف (عميل/مورد) للقيد المحاسبي المعين من المستند المصدر */
  async getJournalEntryParty(id: number) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      select: { id: true, sourceType: true, sourceId: true, lines: { select: { partyType: true, partyId: true } } },
    });
    if (!entry) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Journal entry not found', messageAr: 'القيد غير موجود' });
    }
    const spMap = await this.resolveSourcePartyForEntries([{ id: entry.id, sourceType: entry.sourceType, sourceId: entry.sourceId }]);
    const sp = spMap.get(entry.id);
    const partyFromLine = entry.lines?.find((l) => l.partyType && l.partyId);
    let partyName: string | null = null;
    let partyType: string | null = null;
    if (sp?.sourcePartyName) {
      partyName = sp.sourcePartyName;
      partyType = sp.sourcePartyType ?? null;
    } else if (partyFromLine) {
      const keys = [`${partyFromLine.partyType}:${partyFromLine.partyId}`];
      const map = await this.resolvePartyNamesBatch(keys);
      partyName = map.get(keys[0]) ?? null;
      partyType = partyFromLine.partyType;
    }
    return { partyName, partyType };
  }

  async getJournalEntryById(id: number) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, nameEn: true, accountCurrency: true } },
            costCenter: { select: { id: true, code: true, name: true } },
          },
        },
        createdBy: { select: { id: true, username: true, fullName: true } },
      },
    });

    if (!entry) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Journal entry not found',
        messageAr: 'القيد غير موجود',
      });
    }

    // Resolve Party names for lines
    const linesWithParty = await Promise.all(
      entry.lines.map(async (line) => {
        let partyName: string | null = null;
        if (line.partyType === 'customer' && line.partyId) {
          const customer = await this.prisma.customer.findUnique({
            where: { id: line.partyId },
            select: { name: true },
          });
          partyName = customer?.name ?? null;
        } else if (line.partyType === 'supplier' && line.partyId) {
          const supplier = await this.prisma.supplier.findUnique({
            where: { id: line.partyId },
            select: { name: true },
          });
          partyName = supplier?.name ?? null;
        }
        return { ...line, partyName };
      }),
    );

    // Resolve sourcePartyName for entry-level display
    const sourcePartyMap = await this.resolveSourcePartyForEntries([{ id: entry.id, sourceType: entry.sourceType, sourceId: entry.sourceId }]);
    const sp = sourcePartyMap.get(entry.id);

    return {
      ...entry,
      lines: linesWithParty,
      sourcePartyName: sp?.sourcePartyName ?? null,
      sourcePartyType: sp?.sourcePartyType ?? null,
      sourceExpenseCategoryName: sp?.sourceExpenseCategoryName ?? null,
    };
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

      // Read within the same transaction to avoid isolation issues
      const result = await tx.journalEntry.findUnique({
        where: { id: entry.id },
        include: { lines: { include: { account: true, costCenter: true } }, createdBy: true },
      });
      if (!result) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Journal entry not found', messageAr: 'القيد غير موجود' });
      return result;
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

  async getTrialBalance(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : null;
    if (start) start.setUTCHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setUTCHours(23, 59, 59, 999);

    // 1. Get Opening Balances (all entries BEFORE start date)
    const openingGrouped = start ? await this.prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: { journalEntry: { entryDate: { lt: start }, isPosted: true } },
      _sum: { debitAmount: true, creditAmount: true },
    }) : [];

    // 2. Get Period Movements (all entries BETWEEN start and end date)
    const periodGrouped = await this.prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          entryDate: start ? { gte: start, lte: end } : { lte: end },
          isPosted: true
        }
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    // 3. Get all involved account IDs
    const accountIds = Array.from(new Set([
      ...openingGrouped.map(g => g.accountId),
      ...periodGrouped.map(g => g.accountId)
    ]));

    if (accountIds.length === 0) {
      return [];
    }

    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, code: true, name: true, accountType: true, rootType: true },
    });

    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const openingMap = new Map(openingGrouped.map(g => [g.accountId, { debit: g._sum?.debitAmount ?? 0, credit: g._sum?.creditAmount ?? 0 }]));
    const periodMap = new Map(periodGrouped.map(g => [g.accountId, { debit: g._sum?.debitAmount ?? 0, credit: g._sum?.creditAmount ?? 0 }]));

    return accounts.map(account => {
      const opening = openingMap.get(account.id) || { debit: 0, credit: 0 };
      const period = periodMap.get(account.id) || { debit: 0, credit: 0 };

      const openingNet = opening.debit - opening.credit;
      const endingNet = openingNet + period.debit - period.credit;

      return {
        accountId: account.id,
        accountCode: account.code,
        name: account.name,
        nameAr: account.name,
        accountName: account.name, // Keep for backward compatibility
        accountType: account.accountType,
        rootType: account.rootType,
        // Opening (Net)
        openingDebit: openingNet > 0 ? openingNet : 0,
        openingCredit: openingNet < 0 ? Math.abs(openingNet) : 0,
        // Period (Gross Movements)
        periodDebit: period.debit,
        periodCredit: period.credit,
        // Ending (Net)
        endingDebit: endingNet > 0 ? endingNet : 0,
        endingCredit: endingNet < 0 ? Math.abs(endingNet) : 0,
        // Backward Compatibility for Balance Sheet
        debit: period.debit,
        credit: period.credit,
        balance: endingNet,
      };
    }).sort((a, b) => a.accountCode.localeCompare(b.accountCode, undefined, { numeric: true }));
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

    const journalEntryWhere: Record<string, unknown> = { isPosted: true };
    if (startDate || endDate) {
      const entryDate: Record<string, Date> = {};
      if (startDate) entryDate.gte = new Date(startDate);
      if (endDate) {
        // Include full end day: "2026-03-18" should include entries at 23:59:59 on that day
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        entryDate.lte = end;
      }
      journalEntryWhere.entryDate = entryDate;
    }
    const where: Record<string, unknown> = { accountId, journalEntry: journalEntryWhere };

    const lines = await this.prisma.journalEntryLine.findMany({
      where,
      include: { journalEntry: true },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });

    // Batch-resolve party names and reference numbers
    const partyKeys = new Set<string>();
    const sourceKeys = new Set<string>();
    for (const l of lines) {
      if (l.partyType && l.partyId) partyKeys.add(`${l.partyType}:${l.partyId}`);
      const je = l.journalEntry;
      if (je.sourceType && je.sourceId != null) sourceKeys.add(`${je.sourceType}:${je.sourceId}`);
    }

    const [partyMap, refMap, sourcePartyMap] = await Promise.all([
      this.resolvePartyNamesBatch(Array.from(partyKeys)),
      this.resolveReferenceNumbersBatch(Array.from(sourceKeys)),
      this.resolvePartyFromSourceBatch(Array.from(sourceKeys)),
    ]);

    let runningBalance = 0;
    return lines.map((l) => {
      runningBalance += l.debitAmount - l.creditAmount;
      const entry = l.journalEntry;
      const partyKey = l.partyType && l.partyId ? `${l.partyType}:${l.partyId}` : null;
      const sourceKey = entry.sourceType && entry.sourceId != null ? `${entry.sourceType}:${entry.sourceId}` : null;
      const partyFromLine = partyKey ? (partyMap.get(partyKey) ?? null) : null;
      const partyFromSource = sourceKey ? (sourcePartyMap.get(sourceKey) ?? null) : null;
      const partyName = partyFromLine ?? partyFromSource ?? null;
      const referenceNumber = sourceKey ? refMap.get(sourceKey) ?? null : null;
      const transactionTypeAr = SOURCE_TYPE_AR[entry.sourceType ?? ''] ?? entry.sourceType ?? '';
      const descEn = l.description ?? entry.description ?? '';
      const descriptionAr = this.buildDescriptionAr(descEn, transactionTypeAr, partyName);

      return {
        id: l.id,
        entryDate: entry.entryDate,
        entryNumber: entry.entryNumber,
        description: descEn,
        descriptionAr,
        debit: l.debitAmount,
        credit: l.creditAmount,
        balance: runningBalance,
        partyName,
        partyType: l.partyType ?? null,
        transactionType: entry.sourceType ?? null,
        transactionTypeAr,
        referenceNumber,
      };
    });
  }

  private buildDescriptionAr(descEn: string, transactionTypeAr: string, partyName: string | null): string {
    const direct = descEn ? DESCRIPTION_AR[descEn.trim()] : null;
    const base = direct ?? transactionTypeAr;
    return partyName ? `${base} — ${partyName}` : base;
  }

  private async resolvePartyNamesBatch(keys: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const customerIds = new Set<number>();
    const supplierIds = new Set<number>();
    for (const k of keys) {
      const [type, idStr] = k.split(':');
      const id = parseInt(idStr, 10);
      if (type === 'customer') customerIds.add(id);
      else if (type === 'supplier') supplierIds.add(id);
    }
    const [customers, suppliers] = await Promise.all([
      customerIds.size > 0 ? this.prisma.customer.findMany({ where: { id: { in: Array.from(customerIds) } }, select: { id: true, name: true } }) : [],
      supplierIds.size > 0 ? this.prisma.supplier.findMany({ where: { id: { in: Array.from(supplierIds) } }, select: { id: true, name: true } }) : [],
    ]);
    for (const c of customers) map.set(`customer:${c.id}`, c.name);
    for (const s of suppliers) map.set(`supplier:${s.id}`, s.name);
    return map;
  }

  private async resolveReferenceNumbersBatch(keys: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const byType: Record<string, Set<number>> = { sale: new Set(), purchase: new Set(), payment: new Set(), expense: new Set(), credit_note: new Set() };
    for (const k of keys) {
      const [type, idStr] = k.split(':');
      const id = parseInt(idStr, 10);
      if (byType[type]) byType[type].add(id);
    }

    const [sales, purchases, expenses, creditNotes] = await Promise.all([
      byType.sale.size > 0 ? this.prisma.sale.findMany({ where: { id: { in: Array.from(byType.sale) } }, select: { id: true, saleNumber: true } }) : [],
      byType.purchase.size > 0 ? this.prisma.purchase.findMany({ where: { id: { in: Array.from(byType.purchase) } }, select: { id: true, purchaseNumber: true } }) : [],
      byType.expense.size > 0 ? this.prisma.expense.findMany({ where: { id: { in: Array.from(byType.expense) } }, select: { id: true, expenseNumber: true } }) : [],
      byType.credit_note.size > 0 ? this.prisma.creditNote.findMany({ where: { id: { in: Array.from(byType.credit_note) } }, select: { id: true, creditNoteNumber: true } }) : [],
    ]);

    for (const s of sales) map.set(`sale:${s.id}`, s.saleNumber);
    for (const p of purchases) map.set(`purchase:${p.id}`, p.purchaseNumber);
    for (const e of expenses) map.set(`expense:${e.id}`, e.expenseNumber);
    for (const cn of creditNotes) map.set(`credit_note:${cn.id}`, String(cn.creditNoteNumber));
    for (const id of byType.payment) map.set(`payment:${id}`, `PAY-${id}`);
    return map;
  }

  /** استخراج اسم الطرف (عميل/مورد) من المستند المصدر sale, purchase, payment */
  private async resolvePartyFromSourceBatch(keys: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (keys.length === 0) return map;

    const byType: Record<string, Set<number>> = { sale: new Set(), purchase: new Set(), payment: new Set() };
    for (const k of keys) {
      const [type, idStr] = k.split(':');
      const id = parseInt(idStr, 10);
      if (byType[type]) byType[type].add(id);
    }

    const saleIds = Array.from(byType.sale ?? []);
    const purchaseIds = Array.from(byType.purchase ?? []);
    const paymentIds = Array.from(byType.payment ?? []);

    const [sales, purchases, payments] = await Promise.all([
      saleIds.length ? this.prisma.sale.findMany({ where: { id: { in: saleIds } }, select: { id: true, customerId: true, customerName: true } }) : [],
      purchaseIds.length ? this.prisma.purchase.findMany({ where: { id: { in: purchaseIds } }, select: { id: true, supplierId: true, supplierName: true } }) : [],
      paymentIds.length ? this.prisma.payment.findMany({ where: { id: { in: paymentIds } }, select: { id: true, partyType: true, partyId: true, partyName: true } }) : [],
    ]);

    const customerIds = [...new Set(sales.filter(s => s.customerId).map(s => s.customerId!))];
    const supplierIdsFromPurchases = [...new Set(purchases.map(p => p.supplierId))];
    const supplierIdsFromPayments = [...new Set(payments.filter(p => p.partyType === 'supplier' && p.partyId).map(p => p.partyId!))];
    const customerIdsFromPayments = [...new Set(payments.filter(p => p.partyType === 'customer' && p.partyId).map(p => p.partyId!))];
    const allCustomerIds = [...new Set([...customerIds, ...customerIdsFromPayments])];
    const allSupplierIds = [...new Set([...supplierIdsFromPurchases, ...supplierIdsFromPayments])];

    const [customers, suppliers] = await Promise.all([
      allCustomerIds.length ? this.prisma.customer.findMany({ where: { id: { in: allCustomerIds } }, select: { id: true, name: true } }) : [],
      allSupplierIds.length ? this.prisma.supplier.findMany({ where: { id: { in: allSupplierIds } }, select: { id: true, name: true } }) : [],
    ]);
    const customerMap = new Map(customers.map(c => [c.id, c.name]));
    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

    for (const s of sales) {
      const name = s.customerId ? (customerMap.get(s.customerId) ?? s.customerName) : (s.customerName ?? null);
      if (name) map.set(`sale:${s.id}`, name);
    }
    for (const p of purchases) {
      const name = supplierMap.get(p.supplierId) ?? p.supplierName ?? null;
      if (name) map.set(`purchase:${p.id}`, name);
    }
    for (const pay of payments) {
      let name = pay.partyName ?? null;
      if (!name && pay.partyType === 'customer' && pay.partyId) name = customerMap.get(pay.partyId) ?? null;
      if (!name && pay.partyType === 'supplier' && pay.partyId) name = supplierMap.get(pay.partyId) ?? null;
      if (name) map.set(`payment:${pay.id}`, name);
    }
    return map;
  }

  /** Resolve sourcePartyName, sourcePartyType, sourceExpenseCategoryName for journal entries */
  private async resolveSourcePartyForEntries(entries: { id: number; sourceType: string | null; sourceId: number | null }[]): Promise<Map<number, { sourcePartyName: string; sourcePartyType?: string; sourceExpenseCategoryName?: string }>> {
    const map = new Map<number, { sourcePartyName: string; sourcePartyType?: string; sourceExpenseCategoryName?: string }>();
    if (entries.length === 0) return map;

    const byType: Record<string, number[]> = {};
    for (const e of entries) {
      if (!e.sourceType || e.sourceId == null) continue;
      if (!byType[e.sourceType]) byType[e.sourceType] = [];
      byType[e.sourceType].push(e.sourceId);
    }

    const saleIds = [...new Set(byType.sale ?? [])];
    const purchaseIds = [...new Set(byType.purchase ?? [])];
    const paymentIds = [...new Set(byType.payment ?? [])];
    const expenseIds = [...new Set(byType.expense ?? [])];
    const [sales, purchases, payments, expenses] = await Promise.all([
      saleIds.length ? this.prisma.sale.findMany({ where: { id: { in: saleIds } }, select: { id: true, customerId: true, customerName: true } }) : [],
      purchaseIds.length ? this.prisma.purchase.findMany({ where: { id: { in: purchaseIds } }, select: { id: true, supplierId: true, supplierName: true } }) : [],
      paymentIds.length ? this.prisma.payment.findMany({ where: { id: { in: paymentIds } }, select: { id: true, partyType: true, partyId: true, partyName: true } }) : [],
      expenseIds.length ? this.prisma.expense.findMany({ where: { id: { in: expenseIds } }, include: { category: { select: { name: true } } } }) : [],
    ]);

    const customerIdsFromSales = [...new Set(sales.filter(s => s.customerId).map(s => s.customerId!))];
    const customerIdsFromPayments = [...new Set(payments.filter(p => p.partyType === 'customer' && p.partyId).map(p => p.partyId!))];
    const customerIds = [...new Set([...customerIdsFromSales, ...customerIdsFromPayments])];
    const supplierIdsFromPurchases = [...new Set(purchases.map(p => p.supplierId))];
    const supplierIdsFromPayments = [...new Set(payments.filter(p => p.partyType === 'supplier' && p.partyId).map(p => p.partyId!))];
    const allSupplierIds = [...new Set([...supplierIdsFromPurchases, ...supplierIdsFromPayments])];
    const [customers, suppliers] = await Promise.all([
      customerIds.length ? this.prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } }) : [],
      allSupplierIds.length ? this.prisma.supplier.findMany({ where: { id: { in: allSupplierIds } }, select: { id: true, name: true } }) : [],
    ]);
    const customerMap = new Map(customers.map(c => [c.id, c.name]));
    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));

    for (const e of entries) {
      if (!e.sourceType || e.sourceId == null) continue;
      const st = e.sourceType;
      const sid = e.sourceId;

      if (st === 'sale') {
        const sale = sales.find(s => s.id === sid);
        const name = sale?.customerId ? (customerMap.get(sale.customerId) ?? sale.customerName) : (sale?.customerName ?? null);
        if (name) map.set(e.id, { sourcePartyName: name, sourcePartyType: 'customer' });
      } else if (st === 'purchase') {
        const purchase = purchases.find(p => p.id === sid);
        const name = purchase ? (supplierMap.get(purchase.supplierId) ?? purchase.supplierName) : null;
        if (name) map.set(e.id, { sourcePartyName: name, sourcePartyType: 'supplier' });
      } else if (st === 'payment') {
        const payment = payments.find(p => p.id === sid);
        let name = payment?.partyName;
        if (!name && payment?.partyType === 'customer' && payment?.partyId) name = customerMap.get(payment.partyId) ?? null;
        if (!name && payment?.partyType === 'supplier' && payment?.partyId) name = supplierMap.get(payment.partyId) ?? null;
        if (name) map.set(e.id, { sourcePartyName: name, sourcePartyType: payment?.partyType ?? undefined });
      } else if (st === 'expense') {
        const expense = expenses.find(ex => ex.id === sid);
        const name = expense?.category?.name;
        if (name) map.set(e.id, { sourcePartyName: name, sourceExpenseCategoryName: name });
      }
    }
    return map;
  }

  // ============ FINANCIAL STATEMENTS ============

  async getBalanceSheet(asOfDate?: string) {
    const date = asOfDate || new Date().toISOString().split('T')[0];
    const accounts = await this.getTrialBalance(date);

    // Account.rootType is 'Asset'|'Liability'|'Equity'; accountType is 'Bank','Cash','Payable',etc.
    let assets = accounts.filter(a => (a as any).rootType === 'Asset' || a.accountType === 'asset');
    let liabilities = accounts.filter(a => (a as any).rootType === 'Liability' || a.accountType === 'liability');
    let equity = accounts.filter(a => (a as any).rootType === 'Equity' || a.accountType === 'equity');

    // Include key accounts with zero balance for completeness (3100 Capital, 3200 Retained Earnings)
    const keyEquityCodes = [ACCOUNT_CODES.CAPITAL, ACCOUNT_CODES.RETAINED_EARNINGS];
    const equityCodes = new Set(equity.map(e => e.accountCode));
    for (const code of keyEquityCodes) {
      if (!equityCodes.has(code)) {
        const acc = await this.prisma.account.findFirst({
          where: { code, companyId: 1 },
          select: { id: true, code: true, name: true, accountType: true },
        });
        if (acc) {
          equity = [...equity, {
            accountId: acc.id,
            accountCode: acc.code,
            name: acc.name,
            nameAr: acc.name,
            accountName: acc.name,
            accountType: acc.accountType,
            rootType: 'Equity' as const,
            debit: 0,
            credit: 0,
            balance: 0,
            openingDebit: 0,
            openingCredit: 0,
            periodDebit: 0,
            periodCredit: 0,
            endingDebit: 0,
            endingCredit: 0,
          }];
        }
      }
    }
    equity.sort((a, b) => a.accountCode.localeCompare(b.accountCode, undefined, { numeric: true }));

    // Include net income for period (fiscal year start to asOfDate) to balance the sheet
    const netIncomeForPeriod = await this.getNetIncomeForPeriod(date);

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquityFromAccounts = equity.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = totalEquityFromAccounts + netIncomeForPeriod;

    return {
      assets,
      liabilities,
      equity,
      netIncomeForPeriod,
      totalAssets,
      totalLiabilities,
      totalEquity,
      asOfDate: date,
    };
  }

  /** Net income from fiscal year start to asOfDate (for balance sheet equity balancing) */
  private async getNetIncomeForPeriod(asOfDate: string): Promise<number> {
    const d = new Date(asOfDate);
    const year = d.getFullYear();
    const company = await this.prisma.company.findFirst();
    const startMonth = (company?.fiscalYearStartMonth ?? 1) - 1;
    const fiscalStart = new Date(year, startMonth, 1);
    if (d < fiscalStart) {
      fiscalStart.setFullYear(year - 1);
    }
    const startDate = fiscalStart.toISOString().split('T')[0];
    const end = new Date(asOfDate);
    end.setUTCHours(23, 59, 59, 999);
    const endDate = end.toISOString().split('T')[0];
    const is = await this.getIncomeStatement(startDate, endDate);
    return is.netIncome;
  }

  async getIncomeStatement(startDate: string, endDate: string) {
    // Include full end-of-day for endDate
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        journalEntry: {
          entryDate: {
            gte: new Date(startDate),
            lte: end,
          },
          isPosted: true,
        },
      },
      include: {
        account: true,
      },
    });

    // Group by account
    const accountBalances = new Map<number, { account: any; balance: number }>();

    lines.forEach(line => {
      const existing = accountBalances.get(line.accountId);
      const balance = line.debitAmount - line.creditAmount;

      if (existing) {
        existing.balance += balance;
      } else {
        accountBalances.set(line.accountId, {
          account: line.account,
          balance,
        });
      }
    });

    const accounts = Array.from(accountBalances.values());
    // rootType: 'Income'|'Expense' (accountType is 'Income Account','Expense Account',etc.)
    const allRevenue = accounts.filter(a => a.account.rootType === 'Income');
    const allExpenses = accounts.filter(a => a.account.rootType === 'Expense');

    // Separate COGS from other expenses
    const cogsAccounts = allExpenses.filter(e => e.account.code === ACCOUNT_CODES.COST_OF_GOODS_SOLD || e.account.code.startsWith('51'));
    const operatingExpenses = allExpenses.filter(e => !cogsAccounts.includes(e));

    // For revenue accounts, credit is positive (revenue increases with credits)
    const totalRevenue = allRevenue.reduce((sum, a) => sum - a.balance, 0);
    const totalCogs = cogsAccounts.reduce((sum, a) => sum + a.balance, 0);
    const grossProfit = totalRevenue - totalCogs;
    const totalOperatingExpenses = operatingExpenses.reduce((sum, a) => sum + a.balance, 0);
    const operatingProfit = grossProfit - totalOperatingExpenses;
    const netIncome = totalRevenue - (totalCogs + totalOperatingExpenses);

    return {
      revenue: allRevenue.map(r => ({
        accountCode: r.account.code,
        accountName: r.account.name,
        amount: -r.balance,
      })),
      cogs: cogsAccounts.map(c => ({
        accountCode: c.account.code,
        accountName: c.account.name,
        amount: c.balance,
      })),
      operatingExpenses: operatingExpenses.map(e => ({
        accountCode: e.account.code,
        accountName: e.account.name,
        amount: e.balance,
      })),
      totalRevenue,
      totalCogs,
      grossProfit,
      totalOperatingExpenses,
      operatingProfit,
      netIncome,
      startDate,
      endDate,
    };
  }

  // ============ PDF GENERATION ============

  async getBalanceSheetPdf(query: PdfQueryDto) {
    const asOfDate = query.asOfDate || new Date().toISOString().split('T')[0];
    const bs = await this.getBalanceSheet(asOfDate);
    const meta = await this.pdfService.getStoreMeta(this.prisma, query.language || 'en');

    // Sort by account code for proper display order
    const sortByCode = <T extends { accountCode: string }>(arr: T[]) =>
      [...arr].sort((a, b) => a.accountCode.localeCompare(b.accountCode, undefined, { numeric: true }));
    const sortedAssets = sortByCode(bs.assets);
    const sortedLiabilities = sortByCode(bs.liabilities);
    const sortedEquity = sortByCode(bs.equity);

    // Indent by account code depth (1111=0, 1112-001=1)
    const indentForCode = (code: string) => Math.min(2, (code.match(/[-.]/g) || []).length);

    // Equity items: accounts + net income (loss) for period
    const equityItems: PdfSectionItem[] = [
      ...sortedEquity.map(e => ({
        label: `${e.accountCode} ${e.accountName}`,
        labelAr: `${e.accountCode} ${e.accountName}`,
        value: -e.balance,
        indent: indentForCode(e.accountCode),
      })),
      ...(bs.netIncomeForPeriod !== 0 ? [{
        label: 'Net Income (Loss) for Period',
        labelAr: 'صافي الربح (أو الخسارة) للفترة',
        value: bs.netIncomeForPeriod,
        indent: 0,
      }] : []),
    ];

    // Assets: debit balance (positive); Liabilities/Equity: credit balance (negate for display)
    const sections: PdfSection[] = [
      {
        title: 'Assets',
        titleAr: 'الأصول',
        items: sortedAssets.map(a => ({
          label: `${a.accountCode} ${a.accountName}`,
          labelAr: `${a.accountCode} ${a.accountName}`,
          value: a.balance,
          indent: indentForCode(a.accountCode),
        })),
        total: bs.totalAssets,
      },
      {
        title: 'Liabilities',
        titleAr: 'الخصوم',
        items: sortedLiabilities.map(l => ({
          label: `${l.accountCode} ${l.accountName}`,
          labelAr: `${l.accountCode} ${l.accountName}`,
          value: -l.balance,
          indent: indentForCode(l.accountCode),
        })),
        total: Math.abs(bs.totalLiabilities),
      },
      {
        title: 'Equity',
        titleAr: 'حقوق الملكية',
        items: equityItems,
        total: bs.totalEquity, // already includes netIncomeForPeriod
      },
    ];

    const lang = (query.language || 'ar') as 'en' | 'ar';
    const bsData: BalanceSheetPdfData = {
      companyName: meta.storeName || meta.storeNameEn || 'Store',
      reportTitle: 'Balance Sheet',
      reportTitleAr: 'قائمة المركز المالي',
      asOfDateRaw: asOfDate,
      generatedAt: new Date().toISOString(),
      generatedBy: (meta as any).generatedBy,
      currency: lang === 'ar' ? 'شيكل (₪)' : 'ILS (₪)',
      totalAssets: bs.totalAssets,
      branchName: (meta as any).branchName,
      sections: [
        {
          title: 'Assets',
          titleAr: 'الأصول',
          rows: sortedAssets.map(a => ({ code: a.accountCode, name: a.accountName, nameAr: a.accountName, value: a.balance } as BalanceSheetRow)),
          total: bs.totalAssets,
        },
        {
          title: 'Liabilities',
          titleAr: 'الخصوم',
          rows: sortedLiabilities.map(l => ({ code: l.accountCode, name: l.accountName, nameAr: l.accountName, value: -l.balance } as BalanceSheetRow)),
          total: Math.abs(bs.totalLiabilities),
        },
        {
          title: 'Equity',
          titleAr: 'حقوق الملكية',
          rows: [
            ...sortedEquity.map(e => ({ code: e.accountCode, name: e.accountName, nameAr: e.accountName, value: -e.balance } as BalanceSheetRow)),
            ...(bs.netIncomeForPeriod !== 0 ? [{ code: '', name: 'Net Income (Loss) for Period', nameAr: 'صافي الربح (أو الخسارة) للفترة', value: bs.netIncomeForPeriod } as BalanceSheetRow] : []),
          ],
          total: bs.totalEquity,
        },
      ],
      grandTotalLabel: 'Total Equity & Liabilities',
      grandTotalLabelAr: 'إجمالي الخصوم وحقوق الملكية',
      grandTotalValue: Math.abs(bs.totalLiabilities) + bs.totalEquity,
      language: lang,
      appVersion: meta.appVersion,
    };

    return this.pdfService.generate({
      meta: meta as any,
      balanceSheetData: bsData,
    });
  }

  async getIncomeStatementPdf(query: PdfQueryDto) {
    const start = query.startDate || new Date(new Date().setDate(1)).toISOString().split('T')[0];
    const end = query.endDate || new Date().toISOString().split('T')[0];
    const is = await this.getIncomeStatement(start, end);
    const meta = await this.pdfService.getStoreMeta(this.prisma, query.language || 'en');
    const lang = (query.language || 'ar') as 'en' | 'ar';

    const sections: import('../pdf/pdf.types').IncomeStatementSection[] = [
      {
        title: 'Revenue',
        titleAr: 'الإيرادات',
        rows: is.revenue.map(r => ({ code: r.accountCode, name: r.accountName, value: r.amount })),
        total: is.totalRevenue,
      },
      {
        title: 'Direct Costs (COGS)',
        titleAr: 'تكلفة البضاعة المباعة',
        rows: is.cogs.map(c => ({ code: c.accountCode, name: c.accountName, value: c.amount })),
        total: is.totalCogs,
      },
      {
        title: 'Operating Expenses',
        titleAr: 'المصروفات التشغيلية',
        rows: is.operatingExpenses.map(e => ({ code: e.accountCode, name: e.accountName, value: e.amount })),
        total: is.totalOperatingExpenses,
      },
    ];

    const isData: import('../pdf/pdf.types').IncomeStatementPdfData = {
      companyName: meta.storeName || meta.storeNameEn || 'Store',
      reportTitle: 'Income Statement',
      reportTitleAr: 'قائمة الدخل',
      startDate: start,
      endDate: end,
      sections,
      netIncomeLabel: 'Net Income',
      netIncomeLabelAr: 'صافي الربح',
      netIncomeValue: is.netIncome,
      language: lang,
      appVersion: meta.appVersion,
      generatedAt: new Date().toISOString(),
      generatedBy: (meta as any).generatedBy,
      currency: lang === 'ar' ? 'شيكل (₪)' : 'ILS (₪)',
      branchName: (meta as any).branchName,
    };

    return this.pdfService.generate({
      meta: meta as any,
      incomeStatementData: isData,
    });
  }

  async getTrialBalancePdf(query: PdfQueryDto) {
    const start = query.startDate;
    const end = query.asOfDate || query.endDate || new Date().toISOString().split('T')[0];
    const tb = await this.getTrialBalance(start, end);
    const meta = await this.pdfService.getStoreMeta(this.prisma, query.language || 'en');
    const lang = (query.language || 'ar') as 'en' | 'ar';

    const rows: import('../pdf/pdf.types').TrialBalanceRow[] = tb.map(t => ({
      code: t.accountCode,
      name: t.accountName,
      openingDebit: t.openingDebit,
      openingCredit: t.openingCredit,
      periodDebit: t.periodDebit,
      periodCredit: t.periodCredit,
      endingDebit: t.endingDebit,
      endingCredit: t.endingCredit,
    }));

    const totalOpeningDebit = tb.reduce((sum, t) => sum + t.openingDebit, 0);
    const totalOpeningCredit = tb.reduce((sum, t) => sum + t.openingCredit, 0);
    const totalPeriodDebit = tb.reduce((sum, t) => sum + t.periodDebit, 0);
    const totalPeriodCredit = tb.reduce((sum, t) => sum + t.periodCredit, 0);
    const totalEndingDebit = tb.reduce((sum, t) => sum + t.endingDebit, 0);
    const totalEndingCredit = tb.reduce((sum, t) => sum + t.endingCredit, 0);

    // Precise check for balancing (allow small rounding error if using floats, though here they should be decimals)
    const isBalanced = Math.abs(totalEndingDebit - totalEndingCredit) < 0.01;

    const tbData: import('../pdf/pdf.types').TrialBalancePdfData = {
      companyName: meta.storeName || meta.storeNameEn || 'Store',
      reportTitle: 'Trial Balance',
      reportTitleAr: 'ميزان المراجعة',
      startDate: start || 'Start',
      endDate: end,
      rows,
      totalOpeningDebit,
      totalOpeningCredit,
      totalPeriodDebit,
      totalPeriodCredit,
      totalEndingDebit,
      totalEndingCredit,
      isBalanced,
      language: lang,
      appVersion: meta.appVersion,
      generatedAt: new Date().toISOString(),
      generatedBy: (meta as any).generatedBy,
      currency: lang === 'ar' ? 'شيكل (₪)' : 'ILS (₪)',
      branchName: (meta as any).branchName,
    };

    return this.pdfService.generate({
      meta: meta as any,
      trialBalanceData: tbData,
    });
  }

  async getAccountLedgerPdf(accountCode: string, query: PdfQueryDto) {
    const start = query.startDate;
    const end = query.endDate;
    const ledger = await this.getAccountLedger(accountCode, start, end);
    const meta = await this.pdfService.getStoreMeta(this.prisma, query.language || 'en');

    const account = await this.chartOfAccountsService.getAccountByCode(accountCode);
    if (!account) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Account not found', messageAr: 'الحساب غير موجود' });
    }

    const extractionDate = new Date().toISOString().split('T')[0];
    const rows = ledger.map((l: any) => {
      const d = l.entryDate ? new Date(l.entryDate) : null;
      const dateStr = d && !isNaN(d.getTime())
        ? `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
        : '';
      const partyVal = l.partyName ?? ''; // اسم العميل أو المورد فقط، بدون قيم افتراضية
      return {
        date: dateStr,
        entry: l.entryNumber ?? '',
        transactionType: l.transactionTypeAr ?? '',
        reference: l.referenceNumber ?? '',
        party: partyVal,
        description: l.descriptionAr ?? l.description ?? '',
        debit: l.debit,
        credit: l.credit,
        balance: l.balance,
      };
    });

    const subtitle = start && end
      ? `${formatDateForHeader(start)} to ${formatDateForHeader(end)}`
      : start
        ? `From ${formatDateForHeader(start)}`
        : end
          ? `Up to ${formatDateForHeader(end)}`
          : 'All Transactions';
    const subtitleAr = start && end
      ? `${formatDateForHeader(start)} إلى ${formatDateForHeader(end)}`
      : start
        ? `من ${formatDateForHeader(start)}`
        : end
          ? `حتى ${formatDateForHeader(end)}`
          : 'جميع العمليات';

    const options = buildReportPdfOptions(meta as any, {
      title: `Account Ledger: ${account.name}`,
      titleAr: `دفتر الحساب: ${account.name}`,
      subtitle,
      subtitleAr,
      statementAccountInfo: {
        accountName: account.name,
        accountCode: account.code,
        extractionDate,
      },
      columns: [
        { header: 'Date', headerAr: 'التاريخ', field: 'date', width: 'auto' },
        { header: 'Entry', headerAr: 'القيد', field: 'entry', width: 'auto' },
        { header: 'Type', headerAr: 'نوع العملية', field: 'transactionType', width: 'auto' },
        { header: 'Reference', headerAr: 'المرجع', field: 'reference', width: 'auto' },
        { header: 'Party', headerAr: 'الطرف', field: 'party', width: 'auto' },
        { header: 'Description', headerAr: 'الوصف', field: 'description', width: '*' },
        { header: 'Debit', headerAr: 'مدين', field: 'debit', width: 'auto', format: 'currency' },
        { header: 'Credit', headerAr: 'دائن', field: 'credit', width: 'auto', format: 'currency' },
        { header: 'Balance', headerAr: 'الرصيد', field: 'balance', width: 'auto', format: 'currency' },
      ],
      rows,
    });

    return this.pdfService.generate(options);
  }
}