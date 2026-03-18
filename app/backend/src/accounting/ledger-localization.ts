/**
 * Ledger localization - Arabic translations for account statements
 * Used by getAccountLedger and getAccountLedgerPdf
 */

/** English description -> Arabic */
export const DESCRIPTION_AR: Record<string, string> = {
  'Cash received': 'قبض نقدي',
  'Cash payment': 'دفع نقدي',
  'Cash refund': 'استرداد نقدي',
  'Sales revenue': 'إيراد مبيعات',
  'Credit sale': 'بيع آجل',
  'Partial payment - balance due': 'دفع جزئي — رصيد مستحق',
  'Sales discount': 'خصم مبيعات',
  'Cost of goods sold': 'تكلفة البضاعة المباعة',
  'Inventory reduction': 'تخفيض المخزون',
  'Inventory increase': 'زيادة المخزون',
  'Inventory purchase': 'شراء مخزون',
  'Credit purchase': 'شراء آجل',
  'Sales revenue reversal': 'إلغاء إيراد مبيعات',
  'Inventory restoration': 'إرجاع مخزون',
  'Write off receivable': 'شطب ذمم مدينة',
  'Expense on credit': 'مصروف آجل',
  'Stock adjustment (increase)': 'تسوية مخزون (زيادة)',
  'Stock adjustment (decrease)': 'تسوية مخزون (نقصان)',
  'Credit note': 'إشعار دائن',
  'Discount reversal': 'إلغاء خصم',
  'COGS reversal': 'إلغاء تكلفة المبيعات',
  'Inventory adjustment': 'تسوية مخزون',
};

/** sourceType -> Arabic */
export const SOURCE_TYPE_AR: Record<string, string> = {
  sale: 'بيع',
  sale_void: 'إلغاء بيع',
  purchase: 'شراء',
  payment: 'تحصيل / دفع',
  expense: 'مصروف',
  credit_note: 'إشعار دائن',
  adjustment: 'تسوية',
  wastage: 'تلف مخزون',
  reversal: 'قيد عكسي',
  journal_entry: 'قيد يدوي',
};

export function getDescriptionAr(descEn: string | null | undefined): string {
  if (!descEn) return '';
  return DESCRIPTION_AR[descEn] ?? descEn;
}

export function getSourceTypeAr(sourceType: string | null | undefined): string {
  if (!sourceType) return '';
  return SOURCE_TYPE_AR[sourceType] ?? sourceType;
}
