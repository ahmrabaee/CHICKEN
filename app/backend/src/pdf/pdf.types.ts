
export interface PdfMeta {
  title: string;
  titleAr?: string;
  storeName: string;
  storeNameEn?: string;
  branchName?: string;
  taxNumber?: string;
  generatedBy?: string;       // Username
  generatedAt: string;        // ISO timestamp
  language: 'en' | 'ar';
  header?: string;            // Custom header from settings
  footer?: string;            // Custom footer from settings
  logoBase64?: string;        // Optional store logo
  subtitle?: string;
  subtitleAr?: string;
  // Rich header - application & business data
  appName?: string;           // Arabic: برنامج الإدارة المالية
  appNameEn?: string;         // English: Financial Management Program
  appVersion?: string;       // e.g. 1.0.0
  address?: string;          // Business address
  phone?: string;            // Business phone
  email?: string;            // Business email
  website?: string;          // Business website
}

export interface PdfTableColumn {
  header: string;
  headerAr?: string;
  field: string;
  width?: number | string;    // pdfmake column width (e.g., '*', 'auto', 100)
  alignment?: 'left' | 'center' | 'right';
  format?: 'currency' | 'weight' | 'date' | 'number' | 'text';
  bold?: boolean;
}

export interface PdfSummaryItem {
  label: string;
  labelAr?: string;
  value: string | number;
  format?: 'currency' | 'weight' | 'number' | 'text' | 'date';
  bold?: boolean;
}

// NEW: For Financial Statements (grouped sections)
export interface PdfSectionItem {
  label: string;
  labelAr: string;
  value: number;
  indent?: number; // 0, 1, 2...
}

export interface PdfSection {
  title: string;
  titleAr: string;
  items: PdfSectionItem[];
  total?: number;
}

/** Balance Sheet: 3-column table rows (Code | Name | Amount) */
export interface BalanceSheetRow {
  code: string;
  name: string;
  nameAr?: string;
  value: number;
}

export interface BalanceSheetSection {
  title: string;
  titleAr: string;
  rows: BalanceSheetRow[];
  total: number;
}

/** Income Statement: 3-column table rows (Code | Name | Amount) */
export interface IncomeStatementRow {
  code: string;
  name: string;
  nameAr?: string;
  value: number;
  indent?: number;
  /** Whether the row is a subtotal or grand total (for styling) */
  isTotal?: boolean;
  /** Whether the row is a major section header (for styling) */
  isHeader?: boolean;
}

export interface IncomeStatementSection {
  title: string;
  titleAr: string;
  rows: IncomeStatementRow[];
  total: number;
}

export interface IncomeStatementPdfData {
  companyName: string;
  companyNameAr?: string;
  reportTitle: string;
  reportTitleAr: string;
  /** ISO date strings (YYYY-MM-DD) */
  startDate: string;
  endDate: string;
  sections: IncomeStatementSection[];
  netIncomeLabel: string;
  netIncomeLabelAr: string;
  netIncomeValue: number;
  language: 'en' | 'ar';
  appVersion?: string;
  generatedAt?: string;
  generatedBy?: string;
  currency?: string;
  branchName?: string;
}

export interface BalanceSheetPdfData {
  companyName: string;
  companyNameAr?: string;
  reportTitle: string;
  reportTitleAr: string;
  /** ISO date string (YYYY-MM-DD) - preferred for safe formatting */
  asOfDateRaw?: string;
  /** Legacy formatted date - used only if asOfDateRaw omitted */
  asOfDate?: string;
  sections: BalanceSheetSection[];
  grandTotalLabel: string;
  grandTotalLabelAr: string;
  grandTotalValue: number;
  /** Total assets for balance check (assets === liabilities + equity) */
  totalAssets?: number;
  language: 'en' | 'ar';
  appVersion?: string;
  /** ISO timestamp when report was generated */
  generatedAt?: string;
  /** User who generated the report */
  generatedBy?: string;
  /** Currency label for display (e.g. "شيكل") */
  currency?: string;
  /** Branch/store name if applicable */
  branchName?: string;
}

/** Trial Balance: 8-column table rows (Code | Name | Opening D/C | Period D/C | Ending D/C) */
export interface TrialBalanceRow {
  code: string;
  name: string;
  nameAr?: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  endingDebit: number;
  endingCredit: number;
}

export interface TrialBalancePdfData {
  companyName: string;
  companyNameAr?: string;
  reportTitle: string;
  reportTitleAr: string;
  startDate: string;
  endDate: string;
  rows: TrialBalanceRow[];
  totalOpeningDebit: number;
  totalOpeningCredit: number;
  totalPeriodDebit: number;
  totalPeriodCredit: number;
  totalEndingDebit: number;
  totalEndingCredit: number;
  isBalanced: boolean;
  language: 'en' | 'ar';
  appVersion?: string;
  generatedAt?: string;
  generatedBy?: string;
  currency?: string;
  branchName?: string;
}

export interface PdfGenerateOptions {
  meta: PdfMeta;
  columns?: PdfTableColumn[];
  rows?: Record<string, any>[];
  summaryItems?: PdfSummaryItem[];
  sections?: PdfSection[];           // NEW: for financial statements
  grandTotal?: {                     // NEW: for financial statement bottom line
    label: string;
    labelAr: string;
    value: number;
  };
  pageOrientation?: 'portrait' | 'landscape';
  watermark?: string;         // e.g., "VOID" for voided sales
  /** When set, show centered empty state message instead of table (e.g. كشف حساب) */
  statementEmpty?: string;
  /** Party details block for statement header (اسم العميل، الرقم، الهاتف، الفترة...) */
  statementPartyInfo?: {
    partyName: string;
    partyNumber?: string;
    partyAddress?: string;
    partyPhone?: string;
    partyTaxNumber?: string;
    startDate: string;
    endDate: string;
    issueDate: string;
  };
  /** Account ledger header (اسم الحساب، رقم الحساب، تاريخ الاستخراج) */
  statementAccountInfo?: {
    accountName: string;
    accountCode: string;
    extractionDate: string;
  };
  /** Balance Sheet: use professional 3-column layout with dedicated header/footer */
  balanceSheetData?: BalanceSheetPdfData;
  /** Income Statement: use professional 3-column layout matching Balance Sheet */
  incomeStatementData?: IncomeStatementPdfData;
  /** Trial Balance: use professional 8-column layout matching Balance Sheet */
  trialBalanceData?: TrialBalancePdfData;
}
