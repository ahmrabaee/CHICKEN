# Module 10: Reporting

> **Status**: 📋 To Implement  
> **Priority**: P1 - High  
> **PRD Reference**: Business Reports & Analytics

---

## Overview

This module provides:
1. **Sales reports** - Daily, weekly, monthly sales analysis
2. **Profit & Loss** - Revenue, cost, profit breakdown
3. **Inventory reports** - Stock levels, movement, valuation
4. **Debt reports** - Outstanding receivables/payables
5. **Cashier reports** - Daily cash reconciliation
6. **Export functionality** - PDF, Excel exports

---

## Report Categories

```
┌──────────────────────────────────────────────────────────────┐
│                     REPORT DASHBOARD                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  SALES                    FINANCIAL                          │
│  ├─ Daily Sales          ├─ Profit & Loss                   │
│  ├─ Sales by Item        ├─ Cash Flow                       │
│  ├─ Sales by Category    ├─ Trial Balance                   │
│  ├─ Sales by Cashier     └─ Balance Sheet                   │
│  └─ Sales by Customer                                        │
│                                                              │
│  INVENTORY                RECEIVABLES                        │
│  ├─ Stock Levels         ├─ Customer Balances               │
│  ├─ Stock Valuation      ├─ Aging Report                    │
│  ├─ Stock Movement       ├─ Overdue Debts                   │
│  ├─ Low Stock            └─ Collection Forecast             │
│  └─ Expiry Report                                            │
│                                                              │
│  PAYABLES                 PERFORMANCE                        │
│  ├─ Supplier Balances    ├─ Top Selling Items               │
│  └─ Payment Due          ├─ Profit by Item                  │
│                          └─ Wastage Analysis                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### 10.1 Sales Summary Report

```http
GET /reports/sales/summary?from=2026-02-01&to=2026-02-28&branchId=1
```

**Access**: 🔒 Admin only

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | date | Start date (required) |
| `to` | date | End date (required) |
| `branchId` | number | Filter by branch |
| `groupBy` | string | 'day', 'week', 'month' (default: day) |

#### Response (Success - 200)

```typescript
{
  period: {
    from: "2026-02-01",
    to: "2026-02-28"
  },
  branchName: "الفرع الرئيسي",
  
  summary: {
    totalSales: 450,
    totalRevenue: 1500000,        // 1,500.000 SAR
    totalCost: 975000,            // 975.000 SAR
    totalProfit: 525000,          // 525.000 SAR
    profitMargin: 35.00,          // 35%
    
    avgSaleValue: 3333,           // 3.333 SAR average
    
    byPaymentMethod: {
      cash: { count: 400, amount: 1300000 },
      credit: { count: 35, amount: 150000 },
      partial: { count: 15, amount: 50000 }
    },
    
    returns: {
      count: 10,
      amount: 30000,
      costRecovered: 19500
    }
  },
  
  trend: [
    {
      date: "2026-02-01",
      salesCount: 15,
      revenue: 50000,
      cost: 32500,
      profit: 17500
    },
    {
      date: "2026-02-02",
      salesCount: 18,
      revenue: 60000,
      cost: 39000,
      profit: 21000
    }
    // ... continues for each day
  ],
  
  comparison: {
    previousPeriod: {
      from: "2026-01-01",
      to: "2026-01-28",
      revenue: 1400000,
      profit: 490000
    },
    revenueChange: 7.14,          // +7.14%
    profitChange: 7.14            // +7.14%
  }
}
```

---

### 10.2 Sales by Item Report

```http
GET /reports/sales/by-item?from=2026-02-01&to=2026-02-28&branchId=1
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  period: {
    from: "2026-02-01",
    to: "2026-02-28"
  },
  
  items: [
    {
      rank: 1,
      itemId: 10,
      itemCode: "CHIC-001",
      itemName: "دجاج كامل",
      categoryName: "دواجن",
      
      quantitySold: 500.000,
      unitOfMeasure: "kg",
      
      revenue: 400000,            // 400.000 SAR
      cost: 260000,
      profit: 140000,
      profitMargin: 35.00,
      
      contribution: 26.67,        // % of total revenue
      avgPrice: 800               // 0.800 SAR/unit
    },
    {
      rank: 2,
      itemId: 11,
      itemCode: "BEEF-001",
      itemName: "لحم بقري",
      categoryName: "لحوم",
      
      quantitySold: 200.000,
      unitOfMeasure: "kg",
      
      revenue: 300000,
      cost: 180000,
      profit: 120000,
      profitMargin: 40.00,
      
      contribution: 20.00,
      avgPrice: 1500
    }
  ],
  
  totals: {
    totalItems: 25,
    totalRevenue: 1500000,
    totalCost: 975000,
    totalProfit: 525000
  }
}
```

---

### 10.3 Sales by Category Report

```http
GET /reports/sales/by-category?from=2026-02-01&to=2026-02-28
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  period: {
    from: "2026-02-01",
    to: "2026-02-28"
  },
  
  categories: [
    {
      categoryId: 2,
      categoryName: "دواجن",
      
      itemCount: 8,
      salesCount: 200,
      
      revenue: 600000,
      cost: 390000,
      profit: 210000,
      profitMargin: 35.00,
      
      contribution: 40.00
    },
    {
      categoryId: 3,
      categoryName: "لحوم",
      
      itemCount: 5,
      salesCount: 150,
      
      revenue: 450000,
      cost: 270000,
      profit: 180000,
      profitMargin: 40.00,
      
      contribution: 30.00
    }
  ]
}
```

---

### 10.4 Profit & Loss Statement

```http
GET /reports/profit-loss?from=2026-02-01&to=2026-02-28&branchId=1
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  period: {
    from: "2026-02-01",
    to: "2026-02-28"
  },
  branchName: "الفرع الرئيسي",
  
  revenue: {
    grossSales: 1530000,          // Before returns
    salesReturns: -30000,
    netSales: 1500000,            // After returns
    
    otherIncome: 5000,            // Adjustments, etc.
    totalRevenue: 1505000
  },
  
  costOfGoodsSold: {
    openingInventory: 500000,
    purchases: 1200000,
    purchaseReturns: -20000,
    goodsAvailable: 1680000,
    closingInventory: 580000,
    cogs: 1100000
  },
  
  grossProfit: 405000,            // Revenue - COGS
  grossProfitMargin: 26.91,
  
  expenses: {
    wastage: 25000,
    other: 0,
    totalExpenses: 25000
  },
  
  netProfit: 380000,
  netProfitMargin: 25.25,
  
  comparison: {
    previousPeriod: {
      netProfit: 350000
    },
    change: 8.57                  // +8.57%
  }
}
```

---

### 10.5 Inventory Valuation Report

```http
GET /reports/inventory/valuation?branchId=1&asOf=2026-02-28
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  asOfDate: "2026-02-28",
  branchName: "الفرع الرئيسي",
  
  summary: {
    totalItems: 25,
    totalLots: 50,
    totalQuantity: 1500.000,
    totalValue: 750000,           // 750.000 SAR at cost
    
    byStatus: {
      available: { lots: 45, value: 700000 },
      expiring_soon: { lots: 5, value: 50000 }
    }
  },
  
  byCategory: [
    {
      categoryId: 2,
      categoryName: "دواجن",
      itemCount: 8,
      totalQuantity: 500.000,
      totalValue: 250000,
      percentage: 33.33
    }
  ],
  
  items: [
    {
      itemId: 10,
      itemCode: "CHIC-001",
      itemName: "دجاج كامل",
      categoryName: "دواجن",
      
      totalQuantity: 200.000,
      unitOfMeasure: "kg",
      
      avgCost: 5250,              // 5.250 SAR/kg
      totalValue: 105000,
      
      lots: [
        {
          lotNumber: "LOT-20260206-001",
          quantity: 80.000,
          costPerUnit: 5000,
          value: 40000,
          expiryDate: "2026-02-13",
          daysUntilExpiry: 5
        },
        {
          lotNumber: "LOT-20260208-001",
          quantity: 120.000,
          costPerUnit: 5500,
          value: 66000,
          expiryDate: "2026-02-15",
          daysUntilExpiry: 7
        }
      ]
    }
  ]
}
```

---

### 10.6 Stock Movement Report

```http
GET /reports/inventory/movement?from=2026-02-01&to=2026-02-28&itemId=10
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  period: {
    from: "2026-02-01",
    to: "2026-02-28"
  },
  
  item: {
    id: 10,
    code: "CHIC-001",
    name: "دجاج كامل"
  },
  
  summary: {
    openingQuantity: 100.000,
    openingValue: 50000,
    
    movements: {
      purchases: { quantity: 500.000, value: 275000 },
      sales: { quantity: -350.000, value: -192500 },
      returns_in: { quantity: 10.000, value: 5500 },
      wastage: { quantity: -10.000, value: -5500 },
      adjustments: { quantity: 0, value: 0 }
    },
    
    closingQuantity: 250.000,
    closingValue: 132500
  },
  
  movements: [
    {
      date: "2026-02-06",
      type: "purchase",
      reference: "PUR-0015",
      quantity: 100.000,
      unitCost: 5000,
      value: 50000,
      balance: 200.000
    },
    {
      date: "2026-02-06",
      type: "sale",
      reference: "SAL-0042",
      quantity: -25.000,
      unitCost: 5000,
      value: -12500,
      balance: 175.000
    }
    // ... continues
  ]
}
```

---

### 10.7 Accounts Receivable Aging Report

```http
GET /reports/receivables/aging?branchId=1&asOf=2026-02-28
```

**Access**: 🔒 Admin only

#### Response (Success - 200)

```typescript
{
  asOfDate: "2026-02-28",
  
  summary: {
    totalCustomers: 50,
    customersWithBalance: 15,
    totalReceivable: 250000,
    
    aging: {
      current: 100000,            // Not yet due
      days_1_30: 75000,           // 1-30 days overdue
      days_31_60: 40000,          // 31-60 days overdue
      days_61_90: 25000,          // 61-90 days overdue
      over_90: 10000              // >90 days overdue
    }
  },
  
  customers: [
    {
      customerId: 10,
      customerName: "أحمد محمد",
      customerPhone: "0501234567",
      
      totalBalance: 40000,
      
      aging: {
        current: 25000,
        days_1_30: 15000,
        days_31_60: 0,
        days_61_90: 0,
        over_90: 0
      },
      
      oldestDebt: {
        id: 14,
        dueDate: "2026-02-15",
        daysOverdue: 13
      }
    }
  ]
}
```

---

### 10.8 Daily Cash Report

```http
GET /reports/cash/daily?date=2026-02-08&branchId=1
```

**Access**: 🔒 Admin, Cashier

#### Response (Success - 200)

```typescript
{
  date: "2026-02-08",
  branchName: "الفرع الرئيسي",
  
  cashSales: {
    count: 20,
    total: 100000
  },
  
  cashCollections: {
    count: 5,
    total: 30000
  },
  
  cashPurchases: {
    count: 2,
    total: -25000
  },
  
  cashRefunds: {
    count: 1,
    total: -5000
  },
  
  supplierPayments: {
    count: 1,
    total: -20000
  },
  
  netCashFlow: 80000,
  
  byCashier: [
    {
      cashierId: 3,
      cashierName: "محمد الكاشير",
      salesCount: 15,
      salesTotal: 75000,
      collectionsCount: 3,
      collectionsTotal: 20000
    }
  ]
}
```

---

### 10.9 Export Report

```http
GET /reports/export?type=sales-summary&from=2026-02-01&to=2026-02-28&format=excel
```

**Access**: 🔒 Admin only

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Report type (required) |
| `format` | string | 'pdf', 'excel' (required) |
| `from` | date | Start date |
| `to` | date | End date |
| `branchId` | number | Filter by branch |

#### Response

Returns file download.

---

## Implementation Status

| Endpoint | Status | File |
|----------|--------|------|
| `GET /reports/sales/summary` | 📋 To Implement | reports.controller.ts |
| `GET /reports/sales/by-item` | 📋 To Implement | reports.controller.ts |
| `GET /reports/sales/by-category` | 📋 To Implement | reports.controller.ts |
| `GET /reports/profit-loss` | 📋 To Implement | reports.controller.ts |
| `GET /reports/inventory/valuation` | 📋 To Implement | reports.controller.ts |
| `GET /reports/inventory/movement` | 📋 To Implement | reports.controller.ts |
| `GET /reports/receivables/aging` | 📋 To Implement | reports.controller.ts |
| `GET /reports/cash/daily` | 📋 To Implement | reports.controller.ts |
| `GET /reports/export` | 📋 To Implement | reports.controller.ts |
