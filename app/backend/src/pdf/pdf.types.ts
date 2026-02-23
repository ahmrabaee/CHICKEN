
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
}
