export type PdfLanguage = 'en' | 'ar';

type EnumLabelMap = Record<string, { en: string; ar: string }>;

const PAYMENT_STATUS_MAP: EnumLabelMap = {
  paid: { en: 'Paid', ar: 'مدفوع' },
  partial: { en: 'Partial', ar: 'جزئي' },
  unpaid: { en: 'Unpaid', ar: 'غير مدفوع' },
};

const DEBT_STATUS_MAP: EnumLabelMap = {
  open: { en: 'Open', ar: 'مفتوح' },
  outstanding: { en: 'Outstanding', ar: 'مستحق' },
  partial: { en: 'Partial', ar: 'جزئي' },
  paid: { en: 'Paid', ar: 'مدفوع' },
  settled: { en: 'Settled', ar: 'مسدد' },
  overdue: { en: 'Overdue', ar: 'متأخر' },
  written_off: { en: 'Written Off', ar: 'مشطوب' },
};

const EXPENSE_TYPE_MAP: EnumLabelMap = {
  operational: { en: 'Operational', ar: 'تشغيلي' },
  administrative: { en: 'Administrative', ar: 'إداري' },
  marketing: { en: 'Marketing', ar: 'تسويق' },
  utilities: { en: 'Utilities', ar: 'مرافق' },
  transportation: { en: 'Transportation', ar: 'نقل' },
  salary: { en: 'Salary', ar: 'رواتب' },
  capital: { en: 'Capital', ar: 'رأسمالي' },
  other: { en: 'Other', ar: 'أخرى' },
};

const PAYMENT_METHOD_MAP: EnumLabelMap = {
  cash: { en: 'Cash', ar: 'نقدي' },
  card: { en: 'Card', ar: 'بطاقة' },
  bank_transfer: { en: 'Bank Transfer', ar: 'تحويل بنكي' },
  mobile: { en: 'Mobile Payment', ar: 'دفع إلكتروني' },
  check: { en: 'Check', ar: 'شيك' },
  credit: { en: 'Credit', ar: 'آجل' },
};

const VOUCHER_TYPE_MAP: EnumLabelMap = {
  sale: { en: 'Sale', ar: 'بيع' },
  purchase: { en: 'Purchase', ar: 'شراء' },
  payment: { en: 'Payment', ar: 'دفعة' },
  expense: { en: 'Expense', ar: 'مصروف' },
  credit_note: { en: 'Credit Note', ar: 'إشعار دائن' },
};

const PAYMENT_VALIDITY_MAP: EnumLabelMap = {
  valid: { en: 'Valid', ar: 'ساري' },
  voided: { en: 'Voided', ar: 'ملغي' },
};

function localize(value: string | null | undefined, map: EnumLabelMap, lang: PdfLanguage): string {
  if (!value) return '';
  const key = String(value).trim().toLowerCase();
  return map[key]?.[lang] ?? value;
}

export function localizePaymentStatus(value: string | null | undefined, lang: PdfLanguage): string {
  return localize(value, PAYMENT_STATUS_MAP, lang);
}

export function localizeDebtStatus(value: string | null | undefined, lang: PdfLanguage): string {
  return localize(value, DEBT_STATUS_MAP, lang);
}

export function localizeExpenseType(value: string | null | undefined, lang: PdfLanguage): string {
  return localize(value, EXPENSE_TYPE_MAP, lang);
}

export function localizePaymentMethod(value: string | null | undefined, lang: PdfLanguage): string {
  return localize(value, PAYMENT_METHOD_MAP, lang);
}

export function localizeVoucherType(value: string | null | undefined, lang: PdfLanguage): string {
  return localize(value, VOUCHER_TYPE_MAP, lang);
}

export function localizePaymentValidity(isVoided: boolean, lang: PdfLanguage): string {
  return isVoided ? PAYMENT_VALIDITY_MAP.voided[lang] : PAYMENT_VALIDITY_MAP.valid[lang];
}

export function localizeReference(reference: string | null | undefined, lang: PdfLanguage): string {
  if (!reference) return '';
  const match = reference.match(/^([a-z_]+)\s+#(\d+)$/i);
  if (!match) return reference;

  const [, voucherType, voucherId] = match;
  return `${localizeVoucherType(voucherType, lang)} #${voucherId}`;
}

export function buildReferenceLabel(
  referenceType: string | null | undefined,
  referenceId: number | undefined,
  fallbackNumber: string | null | undefined,
  lang: PdfLanguage,
): string {
  if (fallbackNumber) return fallbackNumber;
  if (!referenceType || !referenceId) return '-';
  return `${localizeVoucherType(referenceType, lang)} #${referenceId}`;
}
