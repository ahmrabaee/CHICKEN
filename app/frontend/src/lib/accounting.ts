/**
 * Blueprint 01: Chart of Accounts - root type colors and labels
 */

export const ROOT_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    Asset: { bg: 'bg-blue-500/15', text: 'text-blue-700', label: 'أصول' },
    Liability: { bg: 'bg-red-500/15', text: 'text-red-700', label: 'خصوم' },
    Equity: { bg: 'bg-green-500/15', text: 'text-green-700', label: 'حقوق ملكية' },
    Income: { bg: 'bg-amber-500/15', text: 'text-amber-700', label: 'إيرادات' },
    Expense: { bg: 'bg-orange-500/15', text: 'text-orange-700', label: 'مصروفات' },
};

export const REPORT_TYPE_LABELS: Record<string, string> = {
    'Balance Sheet': 'الميزانية',
    'Profit and Loss': 'قائمة الدخل',
};

/** أنواع الحسابات للقائمة المنسدلة - Create/Edit */
export const ACCOUNT_TYPES = [
    { value: 'Bank', label: 'بنك' },
    { value: 'Cash', label: 'نقد' },
    { value: 'Receivable', label: 'ذمم مدينة' },
    { value: 'Payable', label: 'ذمم دائنة' },
    { value: 'Stock', label: 'مخزون' },
    { value: 'Fixed Asset', label: 'أصول ثابتة' },
    { value: 'Cost of Goods Sold', label: 'تكلفة المبيعات' },
    { value: 'Expense Account', label: 'مصروف' },
    { value: 'Income Account', label: 'إيراد' },
    { value: 'Tax', label: 'ضرائب' },
    { value: 'Round Off', label: 'تقريب' },
    { value: 'Current Asset', label: 'أصول متداولة' },
    { value: 'Current Liability', label: 'خصوم متداولة' },
    { value: 'Equity', label: 'حقوق ملكية' },
    { value: 'Liability', label: 'خصوم' },
    { value: 'Direct Income', label: 'إيراد مباشر' },
    { value: 'Indirect Income', label: 'إيراد غير مباشر' },
    { value: 'Direct Expense', label: 'مصروف مباشر' },
    { value: 'Indirect Expense', label: 'مصروف غير مباشر' },
    { value: 'Stock Adjustment', label: 'تسوية مخزون' },
    { value: 'Other', label: 'أخرى' },
] as const;
