import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

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
    const sales = await this.prisma.sale.findMany({
      where: {
        saleDate: { gte: new Date(startDate), lte: new Date(endDate) },
        isVoided: false,
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
    const purchases = await this.prisma.purchase.findMany({
      where: {
        purchaseDate: { gte: new Date(startDate), lte: new Date(endDate) },
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
    const records = await this.prisma.wastageRecord.findMany({
      where: {
        wastageDate: { gte: new Date(startDate), lte: new Date(endDate) },
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
    const expenses = await this.prisma.expense.findMany({
      where: {
        expenseDate: { gte: new Date(startDate), lte: new Date(endDate) },
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
    const dateRange = { gte: new Date(startDate), lte: new Date(endDate) };

    const [salesAgg, purchasesAgg, expensesAgg] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { saleDate: dateRange, isVoided: false },
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
}
