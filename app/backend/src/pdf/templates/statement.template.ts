import { PdfGenerateOptions, PdfMeta } from '../pdf.types';
import { StatementPdfData } from '../dto/statement.dto';
import { formatDateForHeader } from '../pdf.helpers';

/**
 * Build PDF options for Customer/Supplier Statement (كشف حساب)
 * Professional Arabic RTL layout, A4 print-friendly, with empty state handling.
 */
export function buildStatementPdfOptions(meta: PdfMeta, data: StatementPdfData): PdfGenerateOptions {
    const startFmt = formatDateForHeader(data.startDate);
    const endFmt = formatDateForHeader(data.endDate);
    const isArabic = meta.language === 'ar';
    const issueDate = new Date().toISOString().split('T')[0];
    const issueDateFmt = formatDateForHeader(issueDate);

    // Party subtitle: اسم العميل | الرقم | من–إلى | تاريخ الإصدار
    const partyLine = [
        data.partyName,
        data.partyNumber ? `#${data.partyNumber}` : '',
        `${startFmt} — ${endFmt}`,
        isArabic ? `تاريخ الإصدار: ${issueDateFmt}` : `Issue: ${issueDateFmt}`,
    ]
        .filter(Boolean)
        .join('  |  ');

    const isEmpty =
        data.transactions.length === 0 &&
        data.openingBalance === 0 &&
        data.closingBalance === 0 &&
        data.totalDebits === 0 &&
        data.totalCredits === 0;

    const emptyMessage = isArabic
        ? 'لا توجد حركات لهذا العميل ضمن الفترة المحددة.\n\nملاحظة: كشف حساب العميل يعرض المبيعات (عندما يشتري العميل من المتجر) والمدفوعات. إذا أضفت مشتريات (من الموردين)، استخدم "كشف حساب المورد" من صفحة الموردين.'
        : 'No transactions for this customer within the selected period.\n\nNote: Customer statement shows Sales (when customer buys from the store) and Payments. For purchases from suppliers, use "Supplier Statement" from the Suppliers page.';

    return {
        meta: {
            ...meta,
            title: 'Statement of Account',
            titleAr: 'كشف حساب عميل',
            subtitle: partyLine,
            subtitleAr: partyLine,
        },
        pageOrientation: 'portrait',
        // Party details block: اسم العميل، الرقم، الهاتف، العنوان، الفترة، تاريخ الإصدار
        statementPartyInfo: {
            partyName: data.partyName,
            partyNumber: data.partyNumber,
            partyAddress: data.partyAddress,
            partyPhone: data.partyPhone,
            partyTaxNumber: data.partyTaxNumber,
            startDate: data.startDate,
            endDate: data.endDate,
            issueDate,
        },
        // Statement-specific: empty state or table
        statementEmpty: isEmpty ? emptyMessage : undefined,
        columns: isEmpty
            ? undefined
            : [
                  { header: 'Date', headerAr: 'التاريخ', field: 'date', width: 65, format: 'date' },
                  { header: 'Ref', headerAr: 'المرجع', field: 'reference', width: 75 },
                  { header: 'Type', headerAr: 'نوع الحركة', field: 'type', width: 55 },
                  { header: 'Description', headerAr: 'البيان', field: 'notes', width: '*' },
                  { header: 'Debit', headerAr: 'مدين', field: 'debit', width: 70, format: 'currency' },
                  { header: 'Credit', headerAr: 'دائن', field: 'credit', width: 70, format: 'currency' },
                  { header: 'Balance', headerAr: 'الرصيد', field: 'balance', width: 75, format: 'currency', bold: true },
              ],
        rows: isEmpty
            ? []
            : [
                  {
                      date: data.startDate,
                      type: isArabic ? 'رصيد افتتاحي' : 'Opening Balance',
                      reference: '-',
                      notes: isArabic ? 'رصيد افتتاحي' : 'Opening Balance',
                      debit: data.openingBalance > 0 ? data.openingBalance : 0,
                      credit: data.openingBalance < 0 ? Math.abs(data.openingBalance) : 0,
                      balance: data.openingBalance,
                  },
                  ...data.transactions.map((t) => ({
                      ...t,
                      notes: t.notes ?? t.reference ?? '-',
                  })),
              ] as any[],
        summaryItems:
            isEmpty
                ? undefined
                : [
                      { label: 'Opening Balance', labelAr: 'الرصيد الافتتاحي', value: data.openingBalance, format: 'currency' as const },
                      { label: 'Total Debits', labelAr: 'إجمالي المدين', value: data.totalDebits, format: 'currency' as const },
                      { label: 'Total Credits', labelAr: 'إجمالي الدائن', value: data.totalCredits, format: 'currency' as const },
                      { label: 'Closing Balance', labelAr: 'الرصيد الختامي', value: data.closingBalance, format: 'currency' as const, bold: true },
                  ],
    };
}
