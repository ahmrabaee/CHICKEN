import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockReconciliationService } from '../inventory/stock-ledger/stock-reconciliation.service';
import { PdfService } from '../pdf/pdf.service';
import { PdfQueryDto } from '../pdf/dto/pdf-query.dto';
import { buildReportPdfOptions } from '../pdf/templates/report.template';
import { formatDateForHeader } from '../pdf/pdf.helpers';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private stockReconciliationService: StockReconciliationService,
    private pdfService: PdfService,
  ) {}

  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todaySales,
      lowStockItems,
      pendingReceivables,
      pendingPayables,
    ] = await Promise.all([
      // Today's sales (non-voided)
      this.prisma.sale.aggregate({
        where: { saleDate: { gte: today, lt: tomorrow }, isVoided: false },
        _sum: { totalAmount: true, totalCost: true, totalProfit: true },
        _count: true,
      }),
      // Low stock count (can't do field comparison in Prisma, so count all and filter)
      this.prisma.inventory.findMany({
        include: { item: true },
      }),
      // Pending receivables
      this.prisma.debt.aggregate({
        where: { direction: 'receivable', status: { not: 'paid' } },
        _sum: { totalAmount: true, amountPaid: true },
      }),
      // Pending payables
      this.prisma.debt.aggregate({
        where: { direction: 'payable', status: { not: 'paid' } },
        _sum: { totalAmount: true, amountPaid: true },
      }),
    ]);

    // Filter low stock items where current < min
    const lowStockCount = lowStockItems.filter((inv) => {
      const minStock = (inv.item as any)?.minStockGrams ?? 0;
      return inv.currentQuantityGrams < minStock;
    }).length;

    return {
      sales: {
        today: {
          count: todaySales._count ?? 0,
          totalAmount: todaySales._sum?.totalAmount ?? 0,
          totalCost: todaySales._sum?.totalCost ?? 0,
          totalProfit: todaySales._sum?.totalProfit ?? 0,
        },
      },
      inventory: {
        lowStockCount,
      },
      receivables: (pendingReceivables._sum?.totalAmount ?? 0) - (pendingReceivables._sum?.amountPaid ?? 0),
      payables: (pendingPayables._sum?.totalAmount ?? 0) - (pendingPayables._sum?.amountPaid ?? 0),
    };
  }

  async getSalesReport(startDate: string, endDate: string) {
    const start = new Date(startDate); start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
    const sales = await this.prisma.sale.findMany({
      where: {
        saleDate: { gte: start, lte: end },
        isVoided: false,
        docstatus: 1,
      },
      include: {
        saleLines: { include: { item: true } },
        customer: true,
      },
      orderBy: { saleDate: 'asc' },
    });

    const summary = {
      grossRevenue: sales.reduce((sum, s) => sum + s.grossTotalAmount, 0),
      discounts: sales.reduce((sum, s) => sum + s.discountAmount, 0),
      tax: sales.reduce((sum, s) => sum + s.taxAmount, 0),
      netRevenue: sales.reduce((sum, s) => sum + s.totalAmount, 0),
      cost: sales.reduce((sum, s) => sum + s.totalCost, 0),
      profit: sales.reduce((sum, s) => sum + s.totalProfit, 0),
      count: sales.length,
    };

    // Group by item
    const itemSales = new Map<number, { itemId: number; name: string; weightGrams: number; revenue: number; cost: number }>();
    for (const sale of sales) {
      for (const line of sale.saleLines) {
        const existing = itemSales.get(line.itemId) ?? { itemId: line.itemId, name: line.itemName, weightGrams: 0, revenue: 0, cost: 0 };
        existing.weightGrams += line.weightGrams;
        existing.revenue += line.lineTotalAmount;
        existing.cost += line.lineTotalCost;
        itemSales.set(line.itemId, existing);
      }
    }

    return {
      summary,
      byItem: Array.from(itemSales.values()),
      sales: sales.map((s) => ({
        id: s.id,
        saleNumber: s.saleNumber,
        date: s.saleDate,
        customerName: s.customerName,
        total: s.totalAmount,
        profit: s.totalProfit,
      })),
    };
  }

  async getPurchasesReport(startDate: string, endDate: string) {
    const start = new Date(startDate); start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
    const purchases = await this.prisma.purchase.findMany({
      where: {
        purchaseDate: { gte: start, lte: end },
      },
      include: {
        purchaseLines: { include: { item: true } },
        supplier: true,
      },
      orderBy: { purchaseDate: 'asc' },
    });

    const summary = {
      totalAmount: purchases.reduce((sum, p) => sum + p.totalAmount, 0),
      count: purchases.length,
    };

    // Group by supplier
    const bySupplier = new Map<number, { supplierId: number; name: string; amount: number; count: number }>();
    for (const purchase of purchases) {
      const existing = bySupplier.get(purchase.supplierId) ?? { supplierId: purchase.supplierId, name: purchase.supplierName, amount: 0, count: 0 };
      existing.amount += purchase.totalAmount;
      existing.count++;
      bySupplier.set(purchase.supplierId, existing);
    }

    return {
      summary,
      bySupplier: Array.from(bySupplier.values()),
      purchases: purchases.map((p) => ({
        id: p.id,
        purchaseNumber: p.purchaseNumber,
        date: p.purchaseDate,
        supplierName: p.supplierName,
        total: p.totalAmount,
        status: p.paymentStatus,
      })),
    };
  }

  async getInventoryReport() {
    const inventory = await this.prisma.inventory.findMany({
      include: { item: { include: { category: true } } },
    });

    const lots = await this.prisma.inventoryLot.findMany({
      where: { remainingQuantityGrams: { gt: 0 } },
      include: { item: true },
    });

    const totalValue = inventory.reduce((sum, inv) => sum + inv.totalValue, 0);
    const totalWeight = inventory.reduce((sum, inv) => sum + inv.currentQuantityGrams, 0);

    return {
      summary: {
        totalItems: inventory.length,
        totalWeight,
        totalValue,
        activeLots: lots.length,
      },
      items: inventory.map((inv) => ({
        itemId: inv.itemId,
        itemName: inv.item.name,
        categoryName: inv.item.category?.name,
        currentWeight: inv.currentQuantityGrams,
        reservedWeight: inv.reservedQuantityGrams,
        value: inv.totalValue,
      })),
      lots: lots.map((lot) => ({
        lotNumber: lot.lotNumber,
        itemName: lot.item.name,
        remainingWeight: lot.remainingQuantityGrams,
        unitPrice: lot.unitPurchasePrice,
        expiryDate: lot.expiryDate,
      })),
    };
  }

  async getWastageReport(startDate: string, endDate: string) {
    const start = new Date(startDate); start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
    const records = await this.prisma.wastageRecord.findMany({
      where: {
        wastageDate: { gte: start, lte: end },
      },
      include: { item: true, recordedBy: true },
      orderBy: { wastageDate: 'desc' },
    });

    const summary = {
      totalWeight: records.reduce((sum, r) => sum + r.weightGrams, 0),
      totalCost: records.reduce((sum, r) => sum + r.estimatedCostValue, 0),
      count: records.length,
    };

    // Group by type
    const byType = new Map<string, { type: string; weight: number; cost: number; count: number }>();
    for (const record of records) {
      const existing = byType.get(record.wastageType) ?? { type: record.wastageType, weight: 0, cost: 0, count: 0 };
      existing.weight += record.weightGrams;
      existing.cost += record.estimatedCostValue;
      existing.count++;
      byType.set(record.wastageType, existing);
    }

    return {
      summary,
      byType: Array.from(byType.values()),
      records: records.map((r) => ({
        id: r.id,
        date: r.wastageDate,
        itemName: r.item.name,
        type: r.wastageType,
        weight: r.weightGrams,
        cost: r.estimatedCostValue,
        reason: r.reason,
      })),
    };
  }

  async getExpenseReport(startDate: string, endDate: string) {
    const start = new Date(startDate); start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
    const expenses = await this.prisma.expense.findMany({
      where: {
        expenseDate: { gte: start, lte: end },
      },
      include: { category: true, createdBy: true },
      orderBy: { expenseDate: 'desc' },
    });

    const summary = {
      totalAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
      count: expenses.length,
    };

    // Group by type
    const byType = new Map<string, { type: string; amount: number; count: number }>();
    for (const expense of expenses) {
      const existing = byType.get(expense.expenseType) ?? { type: expense.expenseType, amount: 0, count: 0 };
      existing.amount += expense.amount;
      existing.count++;
      byType.set(expense.expenseType, existing);
    }

    return {
      summary,
      byType: Array.from(byType.values()),
      expenses: expenses.map((e) => ({
        id: e.id,
        date: e.expenseDate,
        type: e.expenseType,
        categoryName: e.category?.name,
        amount: e.amount,
        description: e.description,
      })),
    };
  }

  async getProfitLossReport(startDate: string, endDate: string) {
    const start = new Date(startDate); start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
    const dateRange = { gte: start, lte: end };

    const [salesAgg, purchasesAgg, expensesAgg] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { saleDate: dateRange, isVoided: false, docstatus: 1 },
        _sum: { totalAmount: true, totalCost: true, discountAmount: true },
      }),
      this.prisma.purchase.aggregate({
        where: { purchaseDate: dateRange },
        _sum: { totalAmount: true },
      }),
      this.prisma.expense.aggregate({
        where: { expenseDate: dateRange },
        _sum: { amount: true },
      }),
    ]);

    const revenue = salesAgg._sum?.totalAmount ?? 0;
    const costOfGoodsSold = salesAgg._sum?.totalCost ?? 0;
    const grossProfit = revenue - costOfGoodsSold;
    const expenses = expensesAgg._sum?.amount ?? 0;
    const netProfit = grossProfit - expenses;

    return {
      revenue,
      discounts: salesAgg._sum?.discountAmount ?? 0,
      costOfGoodsSold,
      grossProfit,
      expenses,
      netProfit,
      grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    };
  }

  async getStockVsGLReport(asOfDate: Date, branchId?: number) {
    return this.stockReconciliationService.generateStockVsGLReport(asOfDate, branchId);
  }

  // ─── PDF Generation ───────────────────────────────────────────────────────────

  async getWastageReportPdf(query: PdfQueryDto): Promise<Buffer> {
    const language = query.language || 'ar';
    const start = query.startDate ? new Date(query.startDate) : new Date(new Date().setDate(1));
    const end = query.endDate ? new Date(query.endDate) : new Date();

    const records = await this.prisma.wastageRecord.findMany({
      where: { wastageDate: { gte: start, lte: end } },
      include: { item: true },
      orderBy: { wastageDate: 'asc' },
    });

    const wastageReasonLabels: Record<string, string> = {
      expired: language === 'ar' ? 'منتهي الصلاحية' : 'Expired',
      damaged: language === 'ar' ? 'تالف' : 'Damaged',
      spoiled: language === 'ar' ? 'فاسد' : 'Spoiled',
      processing_loss: language === 'ar' ? 'فقد تصنيع' : 'Processing Loss',
      other: language === 'ar' ? 'أخرى' : 'Other',
    };

    const rows = records.map((r) => ({
      date: r.wastageDate.toISOString().split('T')[0],
      item: r.item.name,
      type: r.wastageType,
      reason: wastageReasonLabels[r.reason ?? ''] ?? r.reason ?? '—',
      weight: (r.weightGrams / 1000).toFixed(3),
      cost: r.estimatedCostValue,
    }));

    const totalCost = records.reduce((s, r) => s + r.estimatedCostValue, 0);
    const totalWeight = records.reduce((s, r) => s + r.weightGrams, 0);

    const meta = await this.pdfService.getStoreMeta(this.prisma, language);
    const options = buildReportPdfOptions(meta as any, {
      title: 'Wastage Report',
      titleAr: 'تقرير الهدر',
      subtitle: `${formatDateForHeader(start)} — ${formatDateForHeader(end)}`,
      subtitleAr: `${formatDateForHeader(start)} — ${formatDateForHeader(end)}`,
      columns: [
        { header: 'Date', headerAr: 'التاريخ', field: 'date', width: 'auto', format: 'date' },
        { header: 'Item', headerAr: 'الصنف', field: 'item', width: '*' },
        { header: 'Type', headerAr: 'النوع', field: 'type', width: 'auto' },
        { header: 'Reason', headerAr: 'السبب', field: 'reason', width: 'auto' },
        { header: 'Weight (kg)', headerAr: 'الوزن (كغ)', field: 'weight', width: 'auto' },
        { header: 'Est. Cost', headerAr: 'التكلفة التقديرية', field: 'cost', width: 'auto', format: 'currency' },
      ],
      rows,
      summaryItems: [
        { label: 'Total Weight (kg)', labelAr: 'إجمالي الوزن (كغ)', value: totalWeight / 1000, format: 'number' },
        { label: 'Total Est. Cost', labelAr: 'إجمالي التكلفة', value: totalCost, format: 'currency', bold: true },
      ],
    });

    return this.pdfService.generate(options);
  }

  async getVatReportPdf(query: PdfQueryDto): Promise<Buffer> {
    const language = query.language || 'ar';
    const start = query.startDate ? new Date(query.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = query.endDate ? new Date(query.endDate) : new Date();

    // Fetch VAT accounts and their GL lines (same logic as VatReportService)
    const accounts = await this.prisma.account.findMany({
      where: { accountType: { in: ['Tax', 'Tax Receivable'] } },
    });
    const accountIds = accounts.map((a) => a.id);
    const codeMap = new Map(accounts.map((a) => [a.id, { code: a.code, name: a.name }]));

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId: { in: accountIds },
        journalEntry: { entryDate: { gte: start, lte: end }, isReversed: false },
      },
    });

    const byAccount: Record<number, { output: number; input: number }> = {};
    for (const a of accountIds) byAccount[a] = { output: 0, input: 0 };
    for (const line of lines) {
      const acc = byAccount[line.accountId];
      if (!acc) continue;
      const account = accounts.find((a) => a.id === line.accountId);
      if (account?.accountType === 'Tax') {
        acc.output += line.creditAmount ?? 0;
        acc.input += line.debitAmount ?? 0;
      } else {
        acc.input += line.debitAmount ?? 0;
        acc.output += line.creditAmount ?? 0;
      }
    }

    const byAccountList = Object.entries(byAccount).map(([idStr, v]) => {
      const id = parseInt(idStr, 10);
      const info = codeMap.get(id) ?? { code: '', name: '' };
      return { accountCode: info.code, accountName: info.name, output: v.output, input: v.input, net: v.output - v.input };
    });

    const outputVat = byAccountList.reduce((s, a) => s + a.output, 0);
    const inputVat = byAccountList.reduce((s, a) => s + a.input, 0);

    const rows = byAccountList.map((a) => ({
      code: a.accountCode,
      account: a.accountName,
      output: a.output,
      input: a.input,
      net: a.net,
    }));

    const meta = await this.pdfService.getStoreMeta(this.prisma, language);
    const options = buildReportPdfOptions(meta as any, {
      title: 'VAT Report',
      titleAr: 'تقرير ضريبة القيمة المضافة',
      subtitle: `${formatDateForHeader(start)} — ${formatDateForHeader(end)}`,
      subtitleAr: `${formatDateForHeader(start)} — ${formatDateForHeader(end)}`,
      columns: [
        { header: 'Account Code', headerAr: 'كود الحساب', field: 'code', width: 'auto' },
        { header: 'Account Name', headerAr: 'اسم الحساب', field: 'account', width: '*' },
        { header: 'Output VAT', headerAr: 'Output VAT', field: 'output', width: 'auto', format: 'currency' },
        { header: 'Input VAT', headerAr: 'Input VAT', field: 'input', width: 'auto', format: 'currency' },
        { header: 'Net', headerAr: 'صافي', field: 'net', width: 'auto', format: 'currency' },
      ],
      rows,
      summaryItems: [
        { label: 'Total Output VAT', labelAr: 'إجمالي ضريبة المخرجات', value: outputVat, format: 'currency' },
        { label: 'Total Input VAT', labelAr: 'إجمالي ضريبة المدخلات', value: inputVat, format: 'currency' },
        { label: 'Net VAT Payable', labelAr: 'صافي المستحق', value: outputVat - inputVat, format: 'currency', bold: true },
      ],
    });

    return this.pdfService.generate(options);
  }

  async getStockVsGLReportPdf(query: PdfQueryDto): Promise<Buffer> {
    const language = query.language || 'ar';
    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();
    const branchId = query.branchId ? parseInt(query.branchId, 10) : undefined;

    const report = await this.stockReconciliationService.generateStockVsGLReport(asOfDate, branchId);

    const rows = report.rows.map((r: any) => ({
      type: r.voucherType,
      voucher: r.voucherId,
      date: typeof r.postingDate === 'string' ? r.postingDate.slice(0, 10) : new Date(r.postingDate).toISOString().slice(0, 10),
      stockValue: r.stockValue,
      accountValue: r.accountValue,
      difference: r.difference,
      source: r.ledgerType,
    }));

    const asOfLabel = formatDateForHeader(asOfDate);
    const meta = await this.pdfService.getStoreMeta(this.prisma, language);
    const options = buildReportPdfOptions(meta as any, {
      title: 'Stock vs GL Report',
      titleAr: 'المخزون مقابل الدفاتر',
      subtitle: `As of: ${asOfLabel}`,
      subtitleAr: `بتاريخ: ${asOfLabel}`,
      columns: [
        { header: 'Type', headerAr: 'النوع', field: 'type', width: 'auto' },
        { header: 'Voucher', headerAr: 'رقم المستند', field: 'voucher', width: 'auto' },
        { header: 'Date', headerAr: 'التاريخ', field: 'date', width: 'auto', format: 'date' },
        { header: 'Stock Value', headerAr: 'قيمة المخزون', field: 'stockValue', width: 'auto', format: 'currency' },
        { header: 'GL Value', headerAr: 'قيمة الدفاتر', field: 'accountValue', width: 'auto', format: 'currency' },
        { header: 'Difference', headerAr: 'الفرق', field: 'difference', width: 'auto', format: 'currency' },
        { header: 'Source', headerAr: 'المصدر', field: 'source', width: 'auto' },
      ],
      rows,
      summaryItems: [
        { label: 'Total Stock Value', labelAr: 'إجمالي قيمة المخزون', value: report.summary.totalStockValue, format: 'currency' },
        { label: 'Total GL Value', labelAr: 'إجمالي قيمة الدفاتر', value: report.summary.totalAccountValue, format: 'currency' },
        { label: 'Total Difference', labelAr: 'إجمالي الفرق', value: report.summary.totalDifference, format: 'currency', bold: true },
      ],
    });

    return this.pdfService.generate(options);
  }
}
