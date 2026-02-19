import axiosInstance from '@/lib/axios';

export interface PdfQueryParams {
  language?: 'en' | 'ar';
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  branchId?: string;
}

type PdfParams = PdfQueryParams & { id?: number; accountCode?: string };

const PDF_REPORT_ENDPOINTS: Record<
  string,
  { buildUrl: (params: PdfParams) => string; filename: string | ((params: PdfParams) => string) }
> = {
  'sales-report': {
    buildUrl: (p) => `/sales/report/pdf?${toQuery(p)}`,
    filename: 'تقرير-المبيعات.pdf',
  },
  'purchases-report': {
    buildUrl: (p) => `/purchases/report/pdf?${toQuery(p)}`,
    filename: 'تقرير-المشتريات.pdf',
  },
  'inventory-report': {
    buildUrl: (p) => `/inventory/report/pdf?${toQuery(p)}`,
    filename: 'تقرير-المخزون.pdf',
  },
  'expenses-report': {
    buildUrl: (p) => `/expenses/report/pdf?${toQuery(p)}`,
    filename: 'تقرير-المصروفات.pdf',
  },
  'receivables-report': {
    buildUrl: (p) => `/debts/receivables/pdf?${toQuery(p)}`,
    filename: 'الذمم-المدينة.pdf',
  },
  'payables-report': {
    buildUrl: (p) => `/debts/payables/pdf?${toQuery(p)}`,
    filename: 'الذمم-الدائنة.pdf',
  },
  'balance-sheet': {
    buildUrl: (p) => `/accounting/reports/balance-sheet/pdf?${toQuery(p)}`,
    filename: 'قائمة-المركز-المالي.pdf',
  },
  'income-statement': {
    buildUrl: (p) => `/accounting/reports/income-statement/pdf?${toQuery(p)}`,
    filename: 'قائمة-الدخل.pdf',
  },
  'trial-balance': {
    buildUrl: (p) => `/accounting/reports/trial-balance/pdf?${toQuery(p)}`,
    filename: 'ميزان-المراجعة.pdf',
  },
  ledger: {
    buildUrl: (p) =>
      `/accounting/reports/ledger/${encodeURIComponent(p.accountCode || '')}/pdf?${toQuery(p)}`,
    filename: (p: PdfParams) => `دفتر-حساب-${p.accountCode || ''}.pdf`,
  },
  'sale-invoice': {
    buildUrl: (p) => `/sales/${p.id}/pdf?${toQuery(p)}`,
    filename: (p: PdfParams) => `فاتورة-${p.id}.pdf`,
  },
  'purchase-order': {
    buildUrl: (p) => `/purchases/${p.id}/pdf?${toQuery(p)}`,
    filename: (p: PdfParams) => `أمر-شراء-${p.id}.pdf`,
  },
  'supplier-statement': {
    buildUrl: (p) => `/suppliers/${p.id}/statement/pdf?${toQuery(p)}`,
    filename: (p: PdfParams) => `كشف-حساب-مورد-${p.id}.pdf`,
  },
  'customer-statement': {
    buildUrl: (p) => `/customers/${p.id}/statement/pdf?${toQuery(p)}`,
    filename: (p: PdfParams) => `كشف-حساب-زبون-${p.id}.pdf`,
  },
  'payment-voucher': {
    buildUrl: (p) => `/payments/${p.id}/pdf?${toQuery(p)}`,
    filename: (p: PdfParams) => `سند-دفع-${p.id}.pdf`,
  },
};

function toQuery(p: PdfQueryParams & { id?: number; accountCode?: string }): string {
  const q = new URLSearchParams();
  q.set('inline', '1'); // inline=1 لتجنب اعتراض IDM على التحميل
  if (p.language) q.set('language', p.language);
  if (p.startDate) q.set('startDate', p.startDate);
  if (p.endDate) q.set('endDate', p.endDate);
  if (p.asOfDate) q.set('asOfDate', p.asOfDate);
  if (p.branchId) q.set('branchId', p.branchId);
  return q.toString();
}

function getFilename(type: string, params: PdfParams): string {
  const config = PDF_REPORT_ENDPOINTS[type];
  if (!config) return 'report.pdf';
  const fn = config.filename;
  return typeof fn === 'function' ? fn(params) : fn;
}

export async function fetchPdfBlob(type: string, params: PdfParams): Promise<Blob> {
  const config = PDF_REPORT_ENDPOINTS[type];
  if (!config) throw new Error(`Unknown PDF report type: ${type}`);

  const url = config.buildUrl(params);
  const response = await axiosInstance.get(url, {
    responseType: 'arraybuffer',
  });

  return new Blob([response.data], { type: 'application/pdf' });
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadReportPdf(
  type: string,
  params: PdfParams,
  customFilename?: string
): Promise<void> {
  const blob = await fetchPdfBlob(type, params);
  const filename = customFilename || getFilename(type, params);
  downloadPdfBlob(blob, filename);
}

export function createPdfObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokePdfObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}

export function getReportTypesWithPdf(): string[] {
  return Object.keys(PDF_REPORT_ENDPOINTS);
}

export function getPdfFilename(type: string, params: PdfParams): string {
  return getFilename(type, params);
}
