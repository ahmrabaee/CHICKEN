/**
 * Database Seed Script
 * 
 * Populates the database with initial reference data:
 * - Roles (Admin, Accountant)
 * - Categories (Chicken product types)
 * - Chart of Accounts
 * - System Settings
 * - Expense Categories
 * - Default Admin User
 * - Customers & Suppliers
 * - Transactions (Sales, Purchases, Expenses, Payments) to test reports
 * 
 * Run with: npm run db:seed
 * 
 * @module prisma/seed
 */

import { PrismaClient } from '@prisma/client/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// =============================================================================
// CONSTANTS
// =============================================================================

const SALT_ROUNDS = 12;

// Role permissions (JSON)
const ADMIN_PERMISSIONS = [
  "dashboard.view",
  "sales.create", "sales.view", "sales.void", "sales.discount.unlimited",
  "purchases.create", "purchases.view", "purchases.approve", "purchases.void",
  "inventory.view", "inventory.adjust", "inventory.transfer",
  "wastage.create", "wastage.view", "wastage.approve",
  "customers.create", "customers.view", "customers.edit", "customers.delete",
  "suppliers.create", "suppliers.view", "suppliers.edit", "suppliers.delete",
  "debts.view", "debts.collect", "debts.pay", "debts.write_off",
  "expenses.create", "expenses.view", "expenses.approve",
  "reports.sales", "reports.inventory", "reports.financial", "reports.export",
  "settings.view", "settings.edit",
  "users.create", "users.view", "users.edit", "users.deactivate",
  "audit.view"
];

const ACCOUNTANT_PERMISSIONS = [
  "dashboard.view",
  "sales.create", "sales.view", "sales.discount.limited",
  "purchases.view",
  "inventory.view",
  "wastage.create", "wastage.view",
  "customers.create", "customers.view",
  "debts.view", "debts.collect",
  "reports.sales"
];

// =============================================================================
// SEED FUNCTIONS
// =============================================================================

async function seedRoles(): Promise<void> {
  console.log('Seeding roles...');

  await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      nameAr: 'مدير النظام',
      description: 'Full system access with all permissions',
      permissions: JSON.stringify(ADMIN_PERMISSIONS),
      isSystemRole: true,
    },
  });

  await prisma.role.upsert({
    where: { name: 'accountant' },
    update: {},
    create: {
      name: 'accountant',
      nameAr: 'محاسب',
      description: 'POS operations with limited administrative access',
      permissions: JSON.stringify(ACCOUNTANT_PERMISSIONS),
      isSystemRole: true,
    },
  });

  console.log('✓ Roles seeded');
}

const PAGE_DEFINITIONS = [
  { key: 'dashboard', path: '/', titleAr: 'لوحة التحكم', groupKey: null, isAdminOnly: false, sortOrder: 0 },
  { key: 'inventory', path: '/inventory', titleAr: 'المخزون', groupKey: 'inventory', isAdminOnly: false, sortOrder: 10 },
  { key: 'inventory-new', path: '/inventory/new', titleAr: 'إضافة صنف', groupKey: 'inventory', isAdminOnly: true, sortOrder: 11 },
  { key: 'sales', path: '/sales', titleAr: 'البيع', groupKey: 'sales', isAdminOnly: false, sortOrder: 20 },
  { key: 'sales-pos', path: '/sales/new', titleAr: 'نقطة البيع', groupKey: 'sales', isAdminOnly: false, sortOrder: 21 },
  { key: 'customers', path: '/customers', titleAr: 'الزبائن', groupKey: null, isAdminOnly: false, sortOrder: 30 },
  { key: 'payments', path: '/payments', titleAr: 'المدفوعات', groupKey: null, isAdminOnly: false, sortOrder: 40 },
  { key: 'reconciliation', path: '/reconciliation', titleAr: 'مطابقة الدفعات', groupKey: null, isAdminOnly: false, sortOrder: 41 },
  { key: 'credit-notes', path: '/credit-notes', titleAr: 'الإشعارات الدائنة', groupKey: null, isAdminOnly: false, sortOrder: 42 },
  { key: 'accounting', path: '/accounting', titleAr: 'المحاسبة', groupKey: null, isAdminOnly: false, sortOrder: 50 },
  { key: 'reports-sales', path: '/reports/sales', titleAr: 'تقارير المبيعات', groupKey: 'reports', isAdminOnly: false, sortOrder: 60 },
  { key: 'reports-holdings', path: '/reports/inventory', titleAr: 'تقارير المخزون', groupKey: 'reports', isAdminOnly: false, sortOrder: 61 },
  { key: 'reports-purchases', path: '/reports/purchases', titleAr: 'تقارير المشتريات', groupKey: 'reports', isAdminOnly: false, sortOrder: 62 },
  { key: 'reports-wastage', path: '/reports/wastage', titleAr: 'تقارير الهدر', groupKey: 'reports', isAdminOnly: false, sortOrder: 63 },
  { key: 'traders', path: '/traders', titleAr: 'التجار', groupKey: null, isAdminOnly: true, sortOrder: 70 },
  { key: 'expenses', path: '/expenses', titleAr: 'المصروفات', groupKey: null, isAdminOnly: true, sortOrder: 80 },
  { key: 'debts', path: '/debts', titleAr: 'الديون', groupKey: null, isAdminOnly: true, sortOrder: 90 },
  { key: 'wastage', path: '/wastage', titleAr: 'الهدر', groupKey: null, isAdminOnly: true, sortOrder: 100 },
  { key: 'purchasing', path: '/purchasing', titleAr: 'الشراء', groupKey: null, isAdminOnly: true, sortOrder: 110 },
  { key: 'reports-expenses', path: '/reports/expenses', titleAr: 'تقارير المصروفات', groupKey: 'reports', isAdminOnly: true, sortOrder: 120 },
  { key: 'reports-financial', path: '/reports/financial', titleAr: 'التقارير المالية', groupKey: 'reports', isAdminOnly: true, sortOrder: 121 },
  { key: 'reports-profit-loss', path: '/reports/profit-loss', titleAr: 'قائمة الدخل', groupKey: 'reports', isAdminOnly: true, sortOrder: 122 },
  { key: 'reports-stock-vs-gl', path: '/reports/stock-vs-gl', titleAr: 'المخزون مقابل الدفاتر', groupKey: 'reports', isAdminOnly: true, sortOrder: 123 },
  { key: 'reports-tax', path: '/reports/tax', titleAr: 'تقارير الضرائب', groupKey: 'reports', isAdminOnly: true, sortOrder: 124 },
  { key: 'reports-vat', path: '/reports/vat', titleAr: 'ضريبة القيمة المضافة', groupKey: 'reports', isAdminOnly: true, sortOrder: 125 },
  { key: 'audit', path: '/audit', titleAr: 'سجل المراجعة', groupKey: null, isAdminOnly: true, sortOrder: 130 },
  { key: 'branches', path: '/branches', titleAr: 'الفروع', groupKey: null, isAdminOnly: true, sortOrder: 140 },
  { key: 'settings', path: '/settings', titleAr: 'الإعدادات', groupKey: null, isAdminOnly: true, sortOrder: 150 },
  { key: 'users', path: '/users', titleAr: 'المستخدمين', groupKey: null, isAdminOnly: true, sortOrder: 160 },
];

const ACCOUNTANT_ALLOWED_KEYS = [
  'dashboard', 'inventory', 'sales', 'sales-pos', 'customers', 'payments',
  'reconciliation', 'credit-notes', 'accounting',
  'reports-sales', 'reports-holdings', 'reports-purchases', 'reports-wastage',
];

async function seedPageDefinitions(): Promise<void> {
  console.log('Seeding page definitions...');

  for (const p of PAGE_DEFINITIONS) {
    await prisma.pageDefinition.upsert({
      where: { key: p.key },
      update: {
        path: p.path,
        titleAr: p.titleAr,
        groupKey: p.groupKey,
        sortOrder: p.sortOrder,
        isAdminOnly: p.isAdminOnly,
      },
      create: {
        key: p.key,
        path: p.path,
        titleAr: p.titleAr,
        groupKey: p.groupKey,
        sortOrder: p.sortOrder,
        isAdminOnly: p.isAdminOnly,
      },
    });
  }

  const accountantRole = await prisma.role.findUnique({ where: { name: 'accountant' } });
  if (!accountantRole) {
    console.warn('Accountant role not found, skipping role_page_access seed');
    return;
  }

  const pages = await prisma.pageDefinition.findMany();
  for (const page of pages) {
    const allowed = page.isAdminOnly ? false : ACCOUNTANT_ALLOWED_KEYS.includes(page.key);
    await prisma.rolePageAccess.upsert({
      where: {
        roleId_pageId: { roleId: accountantRole.id, pageId: page.id },
      },
      update: { allowed },
      create: {
        roleId: accountantRole.id,
        pageId: page.id,
        allowed,
      },
    });
  }

  for (const u of await prisma.user.findMany({
    where: { userRoles: { some: { role: { name: { in: ['accountant', 'cashier'] } } } } },
  })) {
    for (const page of pages) {
      const allowed = page.isAdminOnly ? false : ACCOUNTANT_ALLOWED_KEYS.includes(page.key);
      await prisma.userPageAccess.upsert({
        where: { userId_pageId: { userId: u.id, pageId: page.id } },
        update: {},
        create: { userId: u.id, pageId: page.id, allowed },
      });
    }
  }

  console.log('✓ Page definitions seeded');
}

async function seedCategories(): Promise<void> {
  console.log('Seeding categories...');

  const categories = [
    { code: 'FRESH_WHOLE', name: 'دجاج طازج كامل', nameEn: 'Fresh Whole Chicken', displayOrder: 1, defaultShelfLifeDays: 2, storageType: 'fresh', icon: 'chicken' },
    { code: 'FRESH_PARTS', name: 'قطع دجاج طازجة', nameEn: 'Fresh Chicken Parts', displayOrder: 2, defaultShelfLifeDays: 2, storageType: 'fresh', icon: 'drumstick' },
    { code: 'FROZEN_WHOLE', name: 'دجاج مجمد كامل', nameEn: 'Frozen Whole Chicken', displayOrder: 3, defaultShelfLifeDays: 90, storageType: 'frozen', icon: 'snowflake' },
    { code: 'FROZEN_PARTS', name: 'قطع دجاج مجمدة', nameEn: 'Frozen Chicken Parts', displayOrder: 4, defaultShelfLifeDays: 90, storageType: 'frozen', icon: 'cube' },
    { code: 'PROCESSED', name: 'منتجات مصنعة', nameEn: 'Processed Products', displayOrder: 5, defaultShelfLifeDays: 7, storageType: 'processed', icon: 'package' },
    { code: 'EXTRAS', name: 'إضافات', nameEn: 'Extras & Sides', displayOrder: 6, defaultShelfLifeDays: 1, storageType: 'fresh', icon: 'plus' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { code: cat.code },
      update: {},
      create: cat,
    });
  }

  console.log('✓ Categories seeded');
}

async function seedItems(): Promise<void> {
  console.log('Seeding items...');

  const freshWhole = await prisma.category.findUnique({ where: { code: 'FRESH_WHOLE' } });
  const freshParts = await prisma.category.findUnique({ where: { code: 'FRESH_PARTS' } });
  const catId = freshParts?.id ?? freshWhole?.id ?? 1;

  const items = [
    { code: 'CHK-WHOLE-01', name: 'فروج كامل', nameEn: 'Whole Chicken', defaultSalePrice: 2200, defaultPurchasePrice: 1800, categoryId: freshWhole?.id ?? catId },
    { code: 'CHK-BREAST-01', name: 'صدور دجاج', nameEn: 'Chicken Breast', defaultSalePrice: 3500, defaultPurchasePrice: 2800, categoryId: catId },
    { code: 'CHK-THIGH-01', name: 'أفخاذ دجاج', nameEn: 'Chicken Thighs', defaultSalePrice: 2800, defaultPurchasePrice: 2200, categoryId: catId },
    { code: 'CHK-WING-01', name: 'أجنحة دجاج', nameEn: 'Chicken Wings', defaultSalePrice: 2600, defaultPurchasePrice: 2000, categoryId: catId },
    { code: 'CHK-SKEWER-01', name: 'شيش طاووق', nameEn: 'Chicken Shish', defaultSalePrice: 3000, defaultPurchasePrice: 2400, categoryId: catId },
  ];

  for (const it of items) {
    await prisma.item.upsert({
      where: { code: it.code },
      update: {},
      create: {
        code: it.code,
        name: it.name,
        nameEn: it.nameEn,
        defaultSalePrice: it.defaultSalePrice,
        defaultPurchasePrice: it.defaultPurchasePrice,
        categoryId: it.categoryId,
        requiresScale: true,
        allowNegativeStock: false,
      },
    });
  }

  console.log('✓ Items seeded');
}

async function seedInitialStock(): Promise<void> {
  console.log('Seeding initial stock...');

  const branch = await prisma.branch.findFirst({ where: { isMainBranch: true } });
  if (!branch) return;

  const items = await prisma.item.findMany({ where: { isActive: true }, include: { inventory: true } });
  for (const item of items) {
    const existingInv = item.inventory;
    const stockKg = 50;
    const stockGrams = stockKg * 1000;
    const unitPrice = item.defaultPurchasePrice ?? item.defaultSalePrice;
    const totalValue = Math.round((stockGrams / 1000) * unitPrice);

    if (existingInv && existingInv.length > 0 && existingInv[0].currentQuantityGrams > 0) continue;

    const invData = {
      branchId: branch.id,
      currentQuantityGrams: stockGrams,
      reservedQuantityGrams: 0,
      totalValue,
      averageCost: unitPrice,
    };

    const existing = await prisma.inventory.findFirst({ where: { itemId: item.id, branchId: branch.id } });

    if (!existing) {
      await prisma.inventory.create({
        data: {
          itemId: item.id,
          ...invData,
        }
      });
    }

    const lotNumber = `LOT-SEED-${item.code}`;
    const existingLot = await prisma.inventoryLot.findUnique({ where: { lotNumber } });
    if (!existingLot) {
      await prisma.inventoryLot.create({
        data: {
          itemId: item.id,
          branchId: branch.id,
          lotNumber,
          totalQuantityGrams: stockGrams,
          remainingQuantityGrams: stockGrams,
          unitPurchasePrice: unitPrice,
        }
      });
    }
  }

  console.log('✓ Initial stock seeded');
}

async function seedAccounts(): Promise<void> {
  console.log('Seeding chart of accounts...');

  const accounts = [
    // Assets (1xxx)
    { code: '1000', name: 'الأصول', nameEn: 'Assets', accountType: 'asset', isSystemAccount: true },
    { code: '1100', name: 'الأصول المتداولة', nameEn: 'Current Assets', accountType: 'asset', parentAccountCode: '1000' },
    { code: '1110', name: 'النقدية', nameEn: 'Cash', accountType: 'asset', parentAccountCode: '1100', isSystemAccount: true },
    { code: '1111', name: 'النقد في الصندوق', nameEn: 'Cash in Drawer', accountType: 'asset', parentAccountCode: '1110' },
    { code: '1112', name: 'النقد في البنك', nameEn: 'Cash in Bank', accountType: 'asset', parentAccountCode: '1110' },
    { code: '1120', name: 'حسابات القبض', nameEn: 'Accounts Receivable', accountType: 'asset', parentAccountCode: '1100', isSystemAccount: true },
    { code: '1125', name: 'ضريبة القيمة المضافة القابلة للاسترداد', nameEn: 'VAT Receivable', accountType: 'asset', parentAccountCode: '1100', isSystemAccount: true },
    { code: '1130', name: 'المخزون', nameEn: 'Inventory', accountType: 'asset', parentAccountCode: '1100', isSystemAccount: true },
    { code: '1131', name: 'مخزون الدجاج الطازج', nameEn: 'Fresh Chicken Inventory', accountType: 'asset', parentAccountCode: '1130' },
    { code: '1132', name: 'مخزون الدجاج المجمد', nameEn: 'Frozen Chicken Inventory', accountType: 'asset', parentAccountCode: '1130' },
    { code: '1200', name: 'الأصول الثابتة', nameEn: 'Fixed Assets', accountType: 'asset', parentAccountCode: '1000' },
    { code: '1210', name: 'المعدات', nameEn: 'Equipment', accountType: 'asset', parentAccountCode: '1200' },
    { code: '1220', name: 'الأثاث والتجهيزات', nameEn: 'Furniture & Fixtures', accountType: 'asset', parentAccountCode: '1200' },

    // Liabilities (2xxx)
    { code: '2000', name: 'الخصوم', nameEn: 'Liabilities', accountType: 'liability', isSystemAccount: true },
    { code: '2100', name: 'الخصوم المتداولة', nameEn: 'Current Liabilities', accountType: 'liability', parentAccountCode: '2000' },
    { code: '2110', name: 'حسابات الدفع', nameEn: 'Accounts Payable', accountType: 'liability', parentAccountCode: '2100', isSystemAccount: true },
    { code: '2120', name: 'ضريبة القيمة المضافة المستحقة', nameEn: 'VAT Payable', accountType: 'liability', parentAccountCode: '2100', isSystemAccount: true },
    { code: '2130', name: 'الرواتب المستحقة', nameEn: 'Salaries Payable', accountType: 'liability', parentAccountCode: '2100' },

    // Equity (3xxx)
    { code: '3000', name: 'حقوق الملكية', nameEn: 'Equity', accountType: 'equity', isSystemAccount: true },
    { code: '3100', name: 'رأس المال', nameEn: 'Capital', accountType: 'equity', parentAccountCode: '3000', isSystemAccount: true },
    { code: '3200', name: 'الأرباح المحتجزة', nameEn: 'Retained Earnings', accountType: 'equity', parentAccountCode: '3000', isSystemAccount: true },
    { code: '3300', name: 'السحوبات', nameEn: 'Owner Drawings', accountType: 'equity', parentAccountCode: '3000' },

    // Revenue (4xxx)
    { code: '4000', name: 'الإيرادات', nameEn: 'Revenue', accountType: 'revenue', isSystemAccount: true },
    { code: '4100', name: 'إيرادات المبيعات', nameEn: 'Sales Revenue', accountType: 'revenue', parentAccountCode: '4000', isSystemAccount: true },
    { code: '4110', name: 'مبيعات الدجاج الطازج', nameEn: 'Fresh Chicken Sales', accountType: 'revenue', parentAccountCode: '4100' },
    { code: '4120', name: 'مبيعات الدجاج المجمد', nameEn: 'Frozen Chicken Sales', accountType: 'revenue', parentAccountCode: '4100' },
    { code: '4130', name: 'مبيعات المنتجات المصنعة', nameEn: 'Processed Products Sales', accountType: 'revenue', parentAccountCode: '4100' },
    { code: '4200', name: 'إيرادات أخرى', nameEn: 'Other Revenue', accountType: 'revenue', parentAccountCode: '4000' },
    { code: '4900', name: 'خصومات المبيعات', nameEn: 'Sales Discounts', accountType: 'revenue', parentAccountCode: '4000' },

    // Expenses (5xxx)
    { code: '5000', name: 'المصروفات', nameEn: 'Expenses', accountType: 'expense', isSystemAccount: true },
    { code: '5100', name: 'تكلفة البضاعة المباعة', nameEn: 'Cost of Goods Sold', accountType: 'expense', parentAccountCode: '5000', isSystemAccount: true },
    { code: '5200', name: 'مصروفات التشغيل', nameEn: 'Operating Expenses', accountType: 'expense', parentAccountCode: '5000' },
    { code: '5210', name: 'الإيجار', nameEn: 'Rent', accountType: 'expense', parentAccountCode: '5200' },
    { code: '5220', name: 'المرافق', nameEn: 'Utilities', accountType: 'expense', parentAccountCode: '5200' },
    { code: '5221', name: 'الكهرباء', nameEn: 'Electricity', accountType: 'expense', parentAccountCode: '5220' },
    { code: '5222', name: 'المياه', nameEn: 'Water', accountType: 'expense', parentAccountCode: '5220' },
    { code: '5230', name: 'الرواتب والأجور', nameEn: 'Salaries & Wages', accountType: 'expense', parentAccountCode: '5200' },
    { code: '5240', name: 'الصيانة', nameEn: 'Maintenance', accountType: 'expense', parentAccountCode: '5200' },
    { code: '5250', name: 'مصروفات التوصيل', nameEn: 'Delivery Expenses', accountType: 'expense', parentAccountCode: '5200' },
    { code: '5300', name: 'الفاقد والتالف', nameEn: 'Wastage & Spoilage', accountType: 'expense', parentAccountCode: '5000', isSystemAccount: true },
    { code: '5320', name: 'تعديل المخزون', nameEn: 'Inventory Adjustment', accountType: 'expense', parentAccountCode: '5000', isSystemAccount: true },
    { code: '5400', name: 'مصروفات أخرى', nameEn: 'Other Expenses', accountType: 'expense', parentAccountCode: '5000' },
  ];

  const stats = await seedAccountsBlueprint01(accounts);
  console.log(`✓ Chart of accounts seeded (${stats.count} accounts, companyId=${stats.companyId})`);
}

// Blueprint 01: Chart of Accounts Rebuild - Nested Set, new schema
async function seedAccountsBlueprint01(
  legacyAccounts: Array<{ code: string; name: string; nameEn?: string; accountType: string; parentAccountCode?: string; isSystemAccount?: boolean }>,
): Promise<{ count: number; companyId: number }> {
  const rootTypeMap: Record<string, 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense'> = {
    asset: 'Asset',
    liability: 'Liability',
    equity: 'Equity',
    revenue: 'Income',
    expense: 'Expense',
  };
  const reportType = (rt: string) => (['Asset', 'Liability', 'Equity'].includes(rt) ? 'Balance Sheet' : 'Profit and Loss');
  const opType = (code: string, t: string): string => {
    if (code === '1110' || code === '1111') return 'Cash';
    if (code === '1112') return 'Bank';
    if (code === '1120') return 'Receivable';
    if (code.startsWith('113')) return 'Stock';
    if (code.startsWith('12')) return 'Fixed Asset';
    if (code === '2110') return 'Payable';
    if (code === '2120') return 'Tax';
    if (code === '1125') return 'Tax Receivable';
    if (code.startsWith('31') || code.startsWith('32') || code.startsWith('33')) return 'Equity';
    if (code.startsWith('4')) return 'Income Account';
    if (code === '5100') return 'Cost of Goods Sold';
    if (code === '5320') return 'Stock Adjustment';
    if (code.startsWith('5')) return 'Expense Account';
    return t === 'asset' ? 'Current Asset' : t === 'liability' ? 'Current Liability' : 'Other';
  };

  const company = await prisma.company.upsert({
    where: { code: 'DEFAULT' },
    update: {},
    create: { code: 'DEFAULT', name: 'الشركة الافتراضية', nameEn: 'Default Company', defaultCurrency: 'SAR', fiscalYearStartMonth: 1 },
  });
  const companyId = company.id;

  const codeToId = new Map<string, number>();
  const parentCodes = new Set(legacyAccounts.map((a) => a.parentAccountCode).filter(Boolean));
  const isGroup = (code: string) => parentCodes.has(code) || legacyAccounts.some((a) => a.parentAccountCode === code);

  for (const acc of legacyAccounts) {
    const rootType = rootTypeMap[acc.accountType] ?? 'Asset';
    const created = await prisma.account.upsert({
      where: { code_companyId: { code: acc.code, companyId } },
      update: {},
      create: {
        code: acc.code,
        name: acc.name,
        nameEn: acc.nameEn ?? null,
        rootType,
        reportType: reportType(rootType),
        accountType: opType(acc.code, acc.accountType),
        parentId: acc.parentAccountCode ? codeToId.get(acc.parentAccountCode) ?? null : null,
        companyId,
        isGroup: isGroup(acc.code),
        isSystemAccount: acc.isSystemAccount ?? false,
      },
    });
    codeToId.set(acc.code, created.id);
  }

  const all = await prisma.account.findMany({ where: { companyId }, orderBy: [{ parentId: 'asc' }, { code: 'asc' }] });
  let counter = 0;
  const updates: Array<{ id: number; lft: number; rgt: number }> = [];

  function assign(nodes: typeof all, parentId: number | null) {
    const children = nodes.filter((n) => n.parentId === parentId);
    for (const c of children) {
      const lft = ++counter;
      assign(nodes, c.id);
      const rgt = ++counter;
      updates.push({ id: c.id, lft, rgt });
    }
  }
  const roots = all.filter((a) => !a.parentId);
  for (const r of roots) {
    const lft = ++counter;
    assign(all, r.id);
    const rgt = ++counter;
    updates.push({ id: r.id, lft, rgt });
  }
  for (const u of updates) {
    await prisma.account.update({ where: { id: u.id }, data: { lft: u.lft, rgt: u.rgt } });
  }

  // Blueprint 02: Set round-off account (5400 مصروفات أخرى) for GL Engine
  const roundOffAccountId = codeToId.get('5400');
  if (roundOffAccountId) {
    await prisma.company.update({ where: { id: companyId }, data: { roundOffAccountId } });
  }

  return { count: legacyAccounts.length, companyId };
}

async function seedSystemSettings(): Promise<void> {
  console.log('Seeding system settings...');

  const settings = [
    // General
    { key: 'app.name', value: 'متجر الدجاج', description: 'Application name (Arabic)', dataType: 'string', settingGroup: 'general', isSystem: true },
    { key: 'app.name_en', value: 'Chicken Shop POS', description: 'Application name (English)', dataType: 'string', settingGroup: 'general', isSystem: true },
    { key: 'app.version', value: '1.0.0', description: 'Application version', dataType: 'string', settingGroup: 'general', isSystem: true },
    { key: 'app.default_language', value: 'ar', description: 'Default UI language', dataType: 'string', settingGroup: 'general' },
    { key: 'app.timezone', value: 'Asia/Riyadh', description: 'Default timezone', dataType: 'string', settingGroup: 'general' },

    // Currency & Tax
    { key: 'currency.code', value: 'SAR', description: 'Currency code (ISO 4217)', dataType: 'string', settingGroup: 'currency', isSystem: true },
    { key: 'currency.symbol', value: 'ر.س', description: 'Currency symbol', dataType: 'string', settingGroup: 'currency' },
    { key: 'currency.decimals', value: '2', description: 'Decimal places for display', dataType: 'number', settingGroup: 'currency' },
    { key: 'tax.default_rate', value: '1500', description: 'Default VAT rate (basis points: 1500 = 15%)', dataType: 'number', settingGroup: 'tax', isSystem: true },
    { key: 'tax.registration_number', value: '', description: 'VAT registration number', dataType: 'string', settingGroup: 'tax' },
    { key: 'tax.prices_include_tax', value: 'true', description: 'Display prices inclusive of tax', dataType: 'boolean', settingGroup: 'tax' },

    // Inventory
    { key: 'inventory.default_expiry_alert_days', value: '2', description: 'Days before expiry to show alert', dataType: 'number', settingGroup: 'inventory' },
    { key: 'inventory.low_stock_alert_enabled', value: 'true', description: 'Enable low stock alerts', dataType: 'boolean', settingGroup: 'inventory' },
    { key: 'inventory.allow_negative_stock', value: 'false', description: 'Allow selling when stock is zero', dataType: 'boolean', settingGroup: 'inventory' },
    { key: 'inventory.fifo_enabled', value: 'true', description: 'Use FIFO for cost calculation', dataType: 'boolean', settingGroup: 'inventory', isSystem: true },

    // Numbering
    { key: 'numbering.sale_prefix', value: 'SAL-', description: 'Sale invoice prefix', dataType: 'string', settingGroup: 'numbering' },
    { key: 'numbering.sale_next', value: '1', description: 'Next sale invoice number', dataType: 'number', settingGroup: 'numbering' },
    { key: 'numbering.purchase_prefix', value: 'PUR-', description: 'Purchase order prefix', dataType: 'string', settingGroup: 'numbering' },
    { key: 'numbering.purchase_next', value: '1', description: 'Next purchase number', dataType: 'number', settingGroup: 'numbering' },
    { key: 'numbering.payment_prefix', value: 'PAY-', description: 'Payment receipt prefix', dataType: 'string', settingGroup: 'numbering' },
    { key: 'numbering.payment_next', value: '1', description: 'Next payment number', dataType: 'number', settingGroup: 'numbering' },
    { key: 'numbering.expense_prefix', value: 'EXP-', description: 'Expense prefix', dataType: 'string', settingGroup: 'numbering' },
    { key: 'numbering.expense_next', value: '1', description: 'Next expense number', dataType: 'number', settingGroup: 'numbering' },
    { key: 'numbering.customer_prefix', value: 'C', description: 'Customer number prefix', dataType: 'string', settingGroup: 'numbering' },
    { key: 'numbering.customer_next', value: '1', description: 'Next customer number', dataType: 'number', settingGroup: 'numbering' },
    { key: 'numbering.supplier_prefix', value: 'S', description: 'Supplier number prefix', dataType: 'string', settingGroup: 'numbering' },
    { key: 'numbering.supplier_next', value: '1', description: 'Next supplier number', dataType: 'number', settingGroup: 'numbering' },

    // Scale
    { key: 'scale.enabled', value: 'true', description: 'Digital scale integration enabled', dataType: 'boolean', settingGroup: 'scale' },
    { key: 'scale.port', value: 'COM3', description: 'Scale COM port', dataType: 'string', settingGroup: 'scale' },
    { key: 'scale.baud_rate', value: '9600', description: 'Scale baud rate', dataType: 'number', settingGroup: 'scale' },
    { key: 'scale.protocol', value: 'generic', description: 'Scale protocol (generic, toledo, cas)', dataType: 'string', settingGroup: 'scale' },

    // POS
    { key: 'pos.require_customer', value: 'false', description: 'Require customer for all sales', dataType: 'boolean', settingGroup: 'pos' },
    { key: 'pos.allow_credit_sale', value: 'true', description: 'Allow credit sales', dataType: 'boolean', settingGroup: 'pos' },
    { key: 'pos.accountant_max_discount_pct', value: '500', description: 'Max discount for accountant (basis points: 500 = 5%)', dataType: 'number', settingGroup: 'pos' },
    { key: 'pos.print_receipt', value: 'true', description: 'Auto-print receipt after sale', dataType: 'boolean', settingGroup: 'pos' },
    { key: 'pos.receipt_copies', value: '1', description: 'Number of receipt copies', dataType: 'number', settingGroup: 'pos' },

    // Backup
    { key: 'backup.auto_enabled', value: 'true', description: 'Enable automatic backups', dataType: 'boolean', settingGroup: 'backup' },
    { key: 'backup.frequency_hours', value: '24', description: 'Backup frequency in hours', dataType: 'number', settingGroup: 'backup' },
    { key: 'backup.retention_days', value: '30', description: 'Keep backups for N days', dataType: 'number', settingGroup: 'backup' },
    { key: 'backup.last_backup', value: '', description: 'Last backup timestamp', dataType: 'string', settingGroup: 'backup' },

    // Blueprint 02: GL Engine
    { key: 'gl_engine_enabled', value: 'false', description: 'Use new GL Engine (Phase 02)', dataType: 'boolean', settingGroup: 'accounting', isSystem: true },
    { key: 'gl_debit_credit_tolerance', value: '5', description: 'Tolerance in minor units (e.g. 5 = 0.05 when precision=2)', dataType: 'number', settingGroup: 'accounting', isSystem: true },

    // Blueprint 05: Tax Engine
    { key: 'tax_engine_enabled', value: 'false', description: 'Use Tax Engine - separate VAT GL posting', dataType: 'boolean', settingGroup: 'accounting', isSystem: true },

    // First-Time Setup (NEW - PRD Requirements)
    { key: 'setup_completed', value: 'true', description: 'Whether the initial system setup has been completed', dataType: 'boolean', settingGroup: 'system', isSystem: true },
    { key: 'business_name', value: '', description: 'Business name in Arabic (primary language)', dataType: 'string', settingGroup: 'business', isSystem: true },
    { key: 'business_name_en', value: '', description: 'Business name in English (secondary language)', dataType: 'string', settingGroup: 'business', isSystem: true },
    { key: 'setup_completed_at', value: '', description: 'ISO 8601 timestamp when setup was completed', dataType: 'string', settingGroup: 'system', isSystem: true },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✓ System settings seeded');
}

async function seedTaxTemplates(): Promise<void> {
  console.log('Seeding tax templates...');

  const vatPayable = await prisma.account.findFirst({
    where: { code: '2120', isActive: true },
  });
  const vatReceivable = await prisma.account.findFirst({
    where: { code: '1125', isActive: true },
  });

  if (vatPayable) {
    await prisma.taxTemplate.upsert({
      where: { name: 'VAT 15% Sales' },
      update: {},
      create: {
        name: 'VAT 15% Sales',
        type: 'sales',
        items: {
          create: {
            accountId: vatPayable.id,
            rate: 1500,
            chargeType: 'on_net_total',
            displayOrder: 0,
          },
        },
      },
    });
  }

  if (vatReceivable) {
    await prisma.taxTemplate.upsert({
      where: { name: 'VAT 15% Purchases' },
      update: {},
      create: {
        name: 'VAT 15% Purchases',
        type: 'purchases',
        items: {
          create: {
            accountId: vatReceivable.id,
            rate: 1500,
            chargeType: 'on_net_total',
            isDeductible: true,
            displayOrder: 0,
          },
        },
      },
    });
  }

  console.log('✓ Tax templates seeded');
}

async function seedExpenseCategories(): Promise<void> {
  console.log('Seeding expense categories...');

  const categories = [
    { code: 'OPERATIONAL', name: 'مصروفات تشغيلية', nameEn: 'Operational Expenses', accountCode: '5200' },
    { code: 'RENT', name: 'إيجار', nameEn: 'Rent', accountCode: '5210', parentCode: 'OPERATIONAL' },
    { code: 'UTILITIES', name: 'مرافق', nameEn: 'Utilities', accountCode: '5220', parentCode: 'OPERATIONAL' },
    { code: 'ELECTRICITY', name: 'كهرباء', nameEn: 'Electricity', accountCode: '5221', parentCode: 'UTILITIES' },
    { code: 'WATER', name: 'مياه', nameEn: 'Water', accountCode: '5222', parentCode: 'UTILITIES' },
    { code: 'SALARIES', name: 'رواتب', nameEn: 'Salaries', accountCode: '5230', parentCode: 'OPERATIONAL' },
    { code: 'MAINTENANCE', name: 'صيانة', nameEn: 'Maintenance', accountCode: '5240', parentCode: 'OPERATIONAL' },
    { code: 'DELIVERY', name: 'توصيل', nameEn: 'Delivery', accountCode: '5250', parentCode: 'OPERATIONAL' },
    { code: 'OTHER', name: 'مصروفات أخرى', nameEn: 'Other Expenses', accountCode: '5400' },
  ];

  // First pass: create categories without parent relationships
  for (const cat of categories) {
    await prisma.expenseCategory.upsert({
      where: { code: cat.code },
      update: {},
      create: {
        code: cat.code,
        name: cat.name,
        nameEn: cat.nameEn,
        accountCode: cat.accountCode,
      },
    });
  }

  // Second pass: update parent relationships
  for (const cat of categories) {
    if (cat.parentCode) {
      const parent = await prisma.expenseCategory.findUnique({
        where: { code: cat.parentCode },
      });
      if (parent) {
        await prisma.expenseCategory.update({
          where: { code: cat.code },
          data: { parentCategoryId: parent.id },
        });
      }
    }
  }

  console.log('✓ Expense categories seeded');
}

async function seedDefaultBranch(): Promise<void> {
  console.log('Seeding default branch...');

  await prisma.branch.upsert({
    where: { code: 'BR001' },
    update: {},
    create: {
      code: 'BR001',
      name: 'الفرع الرئيسي',
      nameEn: 'Main Branch',
      address: 'شارع الملك فهد، الرياض',
      phone: '+966-11-123-4567',
      hasScale: true,
      isMainBranch: true,
      isActive: true,
    },
  });

  // Blueprint 06: Set default stock account (1131) for branches - MUST be leaf (isGroup=false), not 1130 which is a group
  const company = await prisma.company.findFirst({ where: { code: 'DEFAULT' } });
  const stockAccount = company
    ? await prisma.account.findFirst({ where: { code: '1131', companyId: company.id } })
    : null;
  if (stockAccount) {
    await prisma.branch.updateMany({
      where: { stockAccountId: null },
      data: { stockAccountId: stockAccount.id },
    });
  }

  console.log('✓ Default branch seeded');
}

async function seedDefaultAdmin(): Promise<void> {
  console.log('Seeding default admin user...');

  const branch = await prisma.branch.findUnique({ where: { code: 'BR001' } });
  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });

  if (!branch || !adminRole) {
    throw new Error('Branch or admin role not found');
  }

  const passwordHash = await bcrypt.hash('Admin@123', SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash, // Update password on re-seed
    },
    create: {
      username: 'admin',
      email: 'admin@chickenshop.local',
      passwordHash,
      fullName: 'مدير النظام',
      fullNameEn: 'System Admin',
      phone: '+966-50-000-0001',
      employeeNumber: 'EMP001',
      preferredLanguage: 'ar',
      defaultBranchId: branch.id,
      isActive: true,
    },
  });

  // Assign admin role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: adminRole.id,
    },
  });

  console.log('✓ Default admin user seeded');
  console.log('  Username: admin');
  console.log('  Password: Admin@123');
}

// =============================================================================
// NEW SEED FUNCTIONS FOR REPORT TESTING
// =============================================================================

async function seedCustomers(): Promise<void> {
  console.log('Seeding customers...');
  const customers = [
    { name: 'مطعم أ', nameEn: 'Restaurant A', phone: '0501234567', email: 'resta@test.com', address: 'Riyadh' },
    { name: 'فندق ب', nameEn: 'Hotel B', phone: '0507654321', email: 'hotelb@test.com', address: 'Jeddah' },
    { name: 'عميل نقدي', nameEn: 'Cash Customer', phone: '0000000000' },
  ];

  // Specific dates for report testing (Feb 2026)
  const SEED_DATES = [
    new Date('2026-02-16T10:00:00'),
    new Date('2026-02-18T14:30:00'),
    new Date('2026-02-19T09:15:00'),
  ];

  for (const c of customers) {
    const existing = await prisma.customer.findFirst({
      where: { phone: c.phone }
    });

    if (!existing) {
      await prisma.customer.create({
        data: {
          name: c.name,
          nameEn: c.nameEn,
          phone: c.phone,
          email: c.email,
          address: c.address,
          customerNumber: `C${Math.floor(Math.random() * 100000) + Date.now().toString().slice(-4)}`,
        }
      });
    }
  }
  console.log('✓ Customers seeded');
}

async function seedSuppliers(): Promise<void> {
  console.log('Seeding suppliers...');
  const suppliers = [
    { name: 'مورد الدواجن المتحدة', nameEn: 'United Poultry Supplier', phone: '0551112222' },
    { name: 'شركة الأعلاف الوطنية', nameEn: 'National Feed Co', phone: '0553334444' },
  ];

  for (const s of suppliers) {
    const existing = await prisma.supplier.findFirst({
      where: { phone: s.phone }
    });

    if (!existing) {
      await prisma.supplier.create({
        data: {
          name: s.name,
          nameEn: s.nameEn,
          phone: s.phone,
          supplierNumber: `S${Math.floor(Math.random() * 100000) + Date.now().toString().slice(-4)}`,
          contactPerson: 'Manager',
        }
      });
    }
  }
  console.log('✓ Suppliers seeded');
}

async function seedPurchases(): Promise<void> {
  console.log('Seeding purchases...');
  const suppliers = await prisma.supplier.findMany();
  const items = await prisma.item.findMany();
  if (suppliers.length === 0 || items.length === 0) return;

  // Create 3 purchases
  for (let i = 0; i < 3; i++) {
    const supplier = suppliers[i % suppliers.length];
    const item = items[0]; // Just picking first item for simplicity

    // Creating a completed purchase
    await prisma.purchase.create({
      data: {
        purchaseNumber: `PUR-SEED-${Date.now()}-${i}`,
        purchaseDate: [
          new Date('2026-02-16T10:00:00'),
          new Date('2026-02-18T14:30:00'),
          new Date('2026-02-19T09:15:00')
        ][i % 3], // Cycle through dates
        supplierId: supplier.id,
        supplierName: supplier.name,
        paymentStatus: 'paid',
        docstatus: 1, // Submitted
        totalAmount: 50000, // 500.00 SAR
        grandTotal: 50000,
        purchaseLines: {
          create: {
            lineNumber: 1,
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            weightGrams: 20000, // 20kg
            pricePerKg: 2500, // 25.00 SAR
            lineTotalAmount: 50000,
          }
        }
      }
    });
  }
  console.log('✓ Purchases seeded');
}

async function seedSales(): Promise<void> {
  console.log('Seeding sales...');
  const customers = await prisma.customer.findMany();
  const items = await prisma.item.findMany();
  const branch = await prisma.branch.findFirst({ where: { isMainBranch: true } });
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });

  if (customers.length === 0 || items.length === 0 || !branch || !admin) return;

  // Create 5 sales
  for (let i = 0; i < 5; i++) {
    const customer = customers[i % customers.length];
    const item = items[0];

    await prisma.sale.create({
      data: {
        saleNumber: `SAL-SEED-${Date.now()}-${i}`,
        saleDate: [
          new Date('2026-02-16T10:00:00'),
          new Date('2026-02-18T14:30:00'),
          new Date('2026-02-19T09:15:00')
        ][i % 3], // Cycle through dates
        customerId: customer.id,
        customerName: customer.name,
        paymentStatus: 'paid',
        docstatus: 1, // Submitted
        totalAmount: 10000, // 100.00 SAR
        grandTotal: 10000,
        cashierId: admin.id,
        branchId: branch.id,
        saleLines: {
          create: {
            lineNumber: 1,
            itemId: item.id,
            itemCode: item.code,
            itemName: item.name,
            weightGrams: 2000, // 2kg
            pricePerKg: 5000, // 50.00 SAR
            netPricePerKg: 5000, // Added required field
            lineTotalAmount: 10000,
          }
        }
      }
    });
  }
  console.log('✓ Sales seeded');
}

async function seedExpenses(): Promise<void> {
  console.log('Seeding expenses...');
  const category = await prisma.expenseCategory.findFirst({ where: { code: 'ELECTRICITY' } });
  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!category || !admin) return;

  // Create 3 expenses
  for (let i = 0; i < 3; i++) {

    await prisma.expense.create({
      data: {
        expenseNumber: `EXP-SEED-${Date.now()}-${i}`,
        expenseDate: [
          new Date('2026-02-16T10:00:00'),
          new Date('2026-02-18T14:30:00'),
          new Date('2026-02-19T09:15:00')
        ][i % 3],
        expenseType: 'operational',
        categoryId: category.id,
        amount: 5000 * (i + 1),
        description: `Expense ${i + 1} - Bill Payment`,
        docstatus: 1,
        createdById: admin.id,
      }
    });
  }
  console.log('✓ Expenses seeded');
}

async function seedPayments(): Promise<void> {
  console.log('Seeding payments...');

  const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!admin) return;

  const dates = [
    new Date('2026-02-16T11:00:00'),
    new Date('2026-02-18T15:00:00'),
    new Date('2026-02-19T10:00:00')
  ];

  // 1. Payment for a Sale (Receipt)
  const sale = await prisma.sale.findFirst();
  if (sale) {
    await prisma.payment.create({
      data: {
        paymentNumber: `PAY-SAL-${Date.now()}`,
        paymentDate: dates[0],
        referenceType: 'sale',
        referenceId: sale.id,
        partyType: 'customer',
        partyId: sale.customerId,
        amount: sale.grandTotal || 0,
        paymentMethod: 'cash',
        docstatus: 1,
        receivedById: admin.id,
        notes: 'Payment for Sale',
      }
    });
  }

  // 2. Payment for a Purchase
  const purchase = await prisma.purchase.findFirst();
  if (purchase) {
    await prisma.payment.create({
      data: {
        paymentNumber: `PAY-PUR-${Date.now()}`,
        paymentDate: dates[1],
        referenceType: 'purchase',
        referenceId: purchase.id,
        partyType: 'supplier',
        partyId: purchase.supplierId,
        amount: purchase.grandTotal || 0,
        paymentMethod: 'bank_transfer',
        docstatus: 1,
        receivedById: admin.id,
        notes: 'Payment for Purchase',
      }
    });
  }

  // 3. General Receipt (Advance)
  await prisma.payment.create({
    data: {
      paymentNumber: `PAY-ADV-${Date.now()}`,
      paymentDate: dates[2],
      referenceType: null, // Advance
      partyType: 'customer',
      partyId: sale?.customerId,
      amount: 1500,
      paymentMethod: 'cash',
      docstatus: 1,
      receivedById: admin.id,
      notes: 'Advance Payment',
    }
  });

  console.log('✓ Payments seeded');
}

// =============================================================================
// MAIN SEED RUNNER
// =============================================================================

async function seedTransactions(): Promise<void> {
  // Wrapper to ensure order
  await seedCustomers();
  await seedSuppliers();

  // Purchases depend on Suppliers
  await seedPurchases();

  // Sales depend on Customer (and Stock if validation enabled, but seed bypasses service logic)
  await seedSales();

  // Expenses depend on Categories (and optionally Suppliers)
  // Expenses depend on Categories (and optionally Suppliers)
  await seedExpenses();

  // Create payments last
  await seedPayments();
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Starting database seed...');
  console.log('='.repeat(60));

  try {
    await seedRoles();
    await seedPageDefinitions();
    await seedCategories();
    await seedAccounts();
    await seedSystemSettings();
    await seedTaxTemplates();
    await seedExpenseCategories();
    await seedDefaultBranch();
    await seedItems();
    await seedInitialStock();
    await seedDefaultAdmin();

    // New Transactional Data
    await seedTransactions();

    console.log('='.repeat(60));
    console.log('✓ Database seeding completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('✗ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
