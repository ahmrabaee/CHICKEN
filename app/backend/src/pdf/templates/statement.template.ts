import { PdfGenerateOptions, PdfMeta } from '../pdf.types';
import { StatementPdfData } from '../dto/statement.dto';
import { formatDateForHeader } from '../pdf.helpers';

export function buildStatementPdfOptions(meta: PdfMeta, data: StatementPdfData): PdfGenerateOptions {
    const startFmt = formatDateForHeader(data.startDate);
    const endFmt = formatDateForHeader(data.endDate);
    return {
        meta: {
            ...meta,
            title: 'Statement of Account',
            titleAr: 'كشف حساب',
            subtitle: `${startFmt} — ${endFmt}`,
            subtitleAr: `${startFmt} — ${endFmt}`,
        },
        pageOrientation: 'portrait',
        columns: [
            { header: 'Date', headerAr: 'التاريخ', field: 'date', width: 'auto', format: 'date' },
            { header: 'Type', headerAr: 'النوع', field: 'type', width: 'auto' },
            { header: 'Ref', headerAr: 'المرجع', field: 'reference', width: 'auto' },
            // { header: 'Notes', headerAr: 'ملاحظات', field: 'notes', width: '*' }, // Optional
            { header: 'Debit', headerAr: 'مدين', field: 'debit', width: 'auto', format: 'currency' },
            { header: 'Credit', headerAr: 'دائن', field: 'credit', width: 'auto', format: 'currency' },
            { header: 'Balance', headerAr: 'الرصيد', field: 'balance', width: 'auto', format: 'currency', bold: true },
        ],
        rows: [
            // Opening Balance Row
            {
                date: data.startDate,
                type: 'Opening Balance',
                reference: '-',
                debit: data.openingBalance > 0 ? data.openingBalance : 0,
                credit: data.openingBalance < 0 ? Math.abs(data.openingBalance) : 0,
                balance: data.openingBalance,
                notes: 'Opening Balance / رصيد افتتاحي'
            },
            ...data.transactions
        ] as any[],
        summaryItems: [
            { label: 'Original Amount', labelAr: 'الرصيد الافتتاحي', value: data.openingBalance, format: 'currency' },
            { label: 'Total Debits', labelAr: 'إجمالي المدين', value: data.totalDebits, format: 'currency' },
            { label: 'Total Credits', labelAr: 'إجمالي الدائن', value: data.totalCredits, format: 'currency' },
            { label: 'Closing Balance', labelAr: 'الرصيد الختامي', value: data.closingBalance, format: 'currency', bold: true },
        ],
    };
}
