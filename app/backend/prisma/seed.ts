/**
 * Database Seed Script
 * 
 * Populates the database with initial reference data:
 * - Roles (Admin, Cashier)
 * - Categories (Chicken product types)
 * - Chart of Accounts
 * - System Settings
 * - Expense Categories
 * - Default Admin User
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

const CASHIER_PERMISSIONS = [
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
    where: { name: 'cashier' },
    update: {},
    create: {
      name: 'cashier',
      nameAr: 'كاشير',
      description: 'POS operations with limited administrative access',
      permissions: JSON.stringify(CASHIER_PERMISSIONS),
      isSystemRole: true,
    },
  });

  console.log('✓ Roles seeded');
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
    { code: '5400', name: 'مصروفات أخرى', nameEn: 'Other Expenses', accountType: 'expense', parentAccountCode: '5000' },
  ];

  for (const acc of accounts) {
    await prisma.account.upsert({
      where: { code: acc.code },
      update: {},
      create: {
        code: acc.code,
        name: acc.name,
        nameEn: acc.nameEn,
        accountType: acc.accountType,
        parentAccountCode: acc.parentAccountCode ?? null,
        isSystemAccount: acc.isSystemAccount ?? false,
      },
    });
  }

  console.log('✓ Chart of accounts seeded');
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
    { key: 'pos.cashier_max_discount_pct', value: '500', description: 'Max discount for cashier (basis points: 500 = 5%)', dataType: 'number', settingGroup: 'pos' },
    { key: 'pos.print_receipt', value: 'true', description: 'Auto-print receipt after sale', dataType: 'boolean', settingGroup: 'pos' },
    { key: 'pos.receipt_copies', value: '1', description: 'Number of receipt copies', dataType: 'number', settingGroup: 'pos' },

    // Backup
    { key: 'backup.auto_enabled', value: 'true', description: 'Enable automatic backups', dataType: 'boolean', settingGroup: 'backup' },
    { key: 'backup.frequency_hours', value: '24', description: 'Backup frequency in hours', dataType: 'number', settingGroup: 'backup' },
    { key: 'backup.retention_days', value: '30', description: 'Keep backups for N days', dataType: 'number', settingGroup: 'backup' },
    { key: 'backup.last_backup', value: '', description: 'Last backup timestamp', dataType: 'string', settingGroup: 'backup' },

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
// MAIN SEED RUNNER
// =============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Starting database seed...');
  console.log('='.repeat(60));

  try {
    await seedRoles();
    await seedCategories();
    await seedAccounts();
    await seedSystemSettings();
    await seedExpenseCategories();
    await seedDefaultBranch();
    await seedDefaultAdmin();

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
