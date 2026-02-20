export type PdfLanguage = 'en' | 'ar';

export interface PdfQueryParams {
  language?: PdfLanguage;
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  branchId?: string;
}

export type ReportPdfType =
  | 'sales-report'
  | 'purchases-report'
  | 'inventory-report'
  | 'expenses-report'
  | 'receivables-report'
  | 'payables-report'
  | 'balance-sheet'
  | 'income-statement'
  | 'trial-balance'
  | 'ledger'
  | 'sale-invoice'
  | 'purchase-order'
  | 'supplier-statement'
  | 'customer-statement'
  | 'payment-voucher';

export interface PdfReportConfig {
  endpoint: string;
  needsDateRange: boolean;
  needsAsOfDate?: boolean;
  needsId?: boolean;
  needsAccountCode?: boolean;
  defaultFilename: string;
}
