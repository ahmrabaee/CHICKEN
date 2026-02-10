/**
 * Reports Module Types — aligned with backend reports.service responses
 */

export interface DateRangeQuery {
  startDate: string;
  endDate: string;
}

/** GET /reports/dashboard */
export interface DashboardSummary {
  sales: {
    today: {
      count: number;
      totalAmount: number;
      totalCost: number;
      totalProfit: number;
    };
  };
  inventory: { lowStockCount: number };
  receivables: number;
  payables: number;
}

/** GET /reports/sales */
export interface SalesReport {
  summary: {
    grossRevenue: number;
    discounts: number;
    tax: number;
    netRevenue: number;
    cost: number;
    profit: number;
    count: number;
  };
  byItem: Array<{ itemId: number; name: string; weightGrams: number; revenue: number; cost: number }>;
  sales: Array<{
    id: number;
    saleNumber: string;
    date: string;
    customerName: string | null;
    total: number;
    profit: number;
  }>;
}

/** GET /reports/purchases */
export interface PurchasesReport {
  summary: { totalAmount: number; count: number };
  bySupplier: Array<{ supplierId: number; name: string; amount: number; count: number }>;
  purchases: Array<{
    id: number;
    purchaseNumber: string;
    date: string;
    supplierName: string;
    total: number;
    status: string;
  }>;
}

/** GET /reports/inventory */
export interface InventoryReport {
  summary: {
    totalItems: number;
    totalWeight: number;
    totalValue: number;
    activeLots: number;
  };
  items: Array<{
    itemId: number;
    itemName: string;
    categoryName: string | null;
    currentWeight: number;
    reservedWeight: number;
    value: number;
  }>;
  lots: Array<{
    lotNumber: string;
    itemName: string;
    remainingWeight: number;
    unitPrice: number;
    expiryDate: string | null;
  }>;
}

/** GET /reports/wastage */
export interface WastageReport {
  summary: { totalWeight: number; totalCost: number; count: number };
  byType: Array<{ type: string; weight: number; cost: number; count: number }>;
  records: Array<{
    id: number;
    date: string;
    itemName: string;
    type: string;
    weight: number;
    cost: number;
    reason: string | null;
  }>;
}

/** GET /reports/expenses */
export interface ExpenseReport {
  summary: { totalAmount: number; count: number };
  byType: Array<{ type: string; amount: number; count: number }>;
  expenses: Array<{
    id: number;
    date: string;
    type: string;
    categoryName: string | null;
    amount: number;
    description: string | null;
  }>;
}

/** GET /reports/profit-loss */
export interface ProfitLossReport {
  revenue: number;
  discounts: number;
  costOfGoodsSold: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
}
