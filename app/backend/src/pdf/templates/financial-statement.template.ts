import { PdfGenerateOptions, PdfMeta, PdfSection } from '../pdf.types';

interface FinancialStatementData {
    title: string;
    titleAr?: string;
    subtitle?: string;
    subtitleAr?: string;
    sections: {
        title: string;
        titleAr: string;
        items: {
            label: string;
            labelAr: string;
            value: number;
            indent?: number;
        }[];
        total?: number;
    }[];
    grandTotal?: {
        label: string;
        labelAr: string;
        value: number;
    };
}

export function buildFinancialStatementPdfOptions(
    meta: PdfMeta,
    data: FinancialStatementData,
): PdfGenerateOptions {

    // Convert template data to PdfSection structure
    // (They are already matching mostly, but ensuring type safety)
    const sections: PdfSection[] = data.sections.map(s => ({
        title: s.title,
        titleAr: s.titleAr,
        items: s.items.map(i => ({
            label: i.label,
            labelAr: i.labelAr,
            value: i.value,
            indent: i.indent
        })),
        total: s.total
    }));

    return {
        meta: {
            ...meta,
            title: data.title,
            titleAr: data.titleAr,
            subtitle: data.subtitle,
            subtitleAr: data.subtitleAr,
        },
        sections: sections,
        grandTotal: data.grandTotal,
        pageOrientation: 'portrait',
    };
}
