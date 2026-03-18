
import { PdfGenerateOptions, PdfMeta, PdfTableColumn, PdfSummaryItem } from '../pdf.types';

export interface ReportPdfData {
    title: string;
    titleAr?: string;
    subtitle?: string;
    subtitleAr?: string;
    columns: PdfTableColumn[];
    rows: any[];
    summaryItems?: PdfSummaryItem[];
    orientation?: 'portrait' | 'landscape';
    /** Account ledger header: اسم الحساب، رقم الحساب، تاريخ الاستخراج */
    statementAccountInfo?: {
        accountName: string;
        accountCode: string;
        extractionDate: string;
    };
}

export function buildReportPdfOptions(meta: PdfMeta, data: ReportPdfData): PdfGenerateOptions {
    return {
        meta: {
            ...meta,
            title: data.title,
            titleAr: data.titleAr,
            subtitle: data.subtitle,
            subtitleAr: data.subtitleAr,
        },
        pageOrientation: data.orientation || 'portrait',
        columns: data.columns,
        rows: data.rows,
        summaryItems: data.summaryItems,
        statementAccountInfo: data.statementAccountInfo,
    };
}
