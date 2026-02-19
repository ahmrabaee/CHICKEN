
import { PdfGenerateOptions, PdfMeta } from '../pdf.types';
import { SaleInvoicePdfData } from '../../sales/dto/sales-pdf.dto';

export function buildInvoicePdfOptions(meta: PdfMeta, data: SaleInvoicePdfData): PdfGenerateOptions {
    return {
        meta: {
            ...meta,
            title: 'Tax Invoice',
            titleAr: 'فاتورة ضريبية',
        },
        pageOrientation: 'portrait',
        watermark: data.isVoided ? (meta.language === 'ar' ? 'ملغاة' : 'VOID') : undefined,
        columns: [
            { header: 'Item', headerAr: 'الصنف', field: 'name', width: '*' },
            { header: 'Qty (kg)', headerAr: 'الوزن', field: 'quantity', width: 'auto', format: 'weight' },
            { header: 'Price', headerAr: 'السعر', field: 'unitPrice', width: 'auto', format: 'currency' },
            { header: 'Total', headerAr: 'الإجمالي', field: 'total', width: 'auto', format: 'currency' },
        ],
        rows: data.items as any[],
        summaryItems: [
            { label: 'Subtotal', labelAr: 'المجموع الفرعي', value: data.subtotal, format: 'currency' },
            { label: 'Discount', labelAr: 'الخصم', value: data.discount, format: 'currency' },
            { label: 'Total', labelAr: 'الإجمالي', value: data.totalAmount, format: 'currency', bold: true },
            { label: 'Paid', labelAr: 'المدفوع', value: data.paidAmount, format: 'currency' },
            { label: 'Balance', labelAr: 'المتـبقي', value: data.balanceDue, format: 'currency' },
        ],
    };
}
