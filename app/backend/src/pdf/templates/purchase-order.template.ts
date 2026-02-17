
import { PdfGenerateOptions, PdfMeta } from '../pdf.types';
import { PurchaseOrderPdfData } from '../../purchases/dto/purchase-pdf.dto';

export function buildPurchaseOrderPdfOptions(meta: PdfMeta, data: PurchaseOrderPdfData): PdfGenerateOptions {
    return {
        meta: {
            ...meta,
            title: 'Purchase Order',
            titleAr: 'أمر شراء',
        },
        pageOrientation: 'portrait',
        columns: [
            { header: 'Item', headerAr: 'الصنف', field: 'itemName', width: '*' },
            { header: 'Code', headerAr: 'الرمز', field: 'itemCode', width: 'auto' },
            { header: 'Qty (kg)', headerAr: 'الوزن', field: 'quantity', width: 'auto', format: 'weight' },
            { header: 'Cost', headerAr: 'التكلفة', field: 'unitPrice', width: 'auto', format: 'currency' },
            { header: 'Total', headerAr: 'الإجمالي', field: 'total', width: 'auto', format: 'currency' },
        ],
        rows: data.items as any[],
        summaryItems: [
            { label: 'Tax', labelAr: 'الضريبة', value: data.taxAmount, format: 'currency' },
            { label: 'Total', labelAr: 'الإجمالي', value: data.totalAmount, format: 'currency', bold: true },
            { label: 'Paid', labelAr: 'المدفوع', value: data.amountPaid, format: 'currency' },
            { label: 'Balance', labelAr: 'المتبقي', value: data.balanceDue, format: 'currency' },
        ],
    };
}
