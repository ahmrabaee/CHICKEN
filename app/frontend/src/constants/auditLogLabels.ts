// Shared source of truth for translating Audit Log entities and actions

export const actionLabels: Record<string, string> = {
    create: "إنشاء",
    update: "تعديل",
    delete: "حذف",
    void: "إلغاء",
    login: "تسجيل دخول",
    logout: "تسجيل خروج",
    cancel: "إلغاء",
    adjustment: "تسوية",
    system_setup_complete: "اكتمال إعداد النظام"
};

export const entityLabels: Record<string, string> = {
    sale: "فاتورة بيع",
    purchase: "أمر شراء",
    payment: "دفعة",
    Payment: "المدفوعات",   // Uppercase variants seen in the screenshot
    expense: "مصروف",
    Expense: "المصروفات",
    customer: "زبون",
    Customer: "العميل",
    supplier: "تاجر",
    Supplier: "التاجر",
    item: "صنف",
    Item: "الصنف",
    user: "مستخدم",
    User: "المستخدم",
    branch: "فرع",
    Branch: "الفرع",
    inventory: "مخزون",
    Inventory: "المخزون",
    system: "نظام",
    System: "النظام",
    StockTransfer: "تبادل مخزون",
    stock_transfer: "تبادل مخزون",
    Category: "تصنيف",
    category: "تصنيف",
    Role: "صلاحية",
    role: "صلاحية",
    Account: "حساب",
    account: "حساب",
    JournalEntry: "قيد محاسبي",
    journal_entry: "قيد محاسبي"
};

/**
 * Returns the Arabic label for an action, or the raw value wrapped in LTR if it's unknown and looks English.
 */
export function getActionLabel(raw: string): string {
    return actionLabels[raw] || raw;
}

/**
 * Returns the Arabic label for an entity, or the raw value wrapped in LTR if it's unknown and looks English.
 */
export function getEntityLabel(raw: string): string {
    return entityLabels[raw] || raw;
}

export function isEnglishString(str: string): boolean {
    return /^[A-Za-z0-9_ -]+$/.test(str);
}
