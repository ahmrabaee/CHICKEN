
import { PdfGenerateOptions, PdfMeta } from '../pdf.types';
import { PaymentPdfData } from '../../payments/dto/payment-pdf.dto';

export function buildPaymentVoucherPdfOptions(meta: PdfMeta, data: PaymentPdfData): PdfGenerateOptions {
    const isReceipt = data.amount > 0 && (data.partyType === 'customer' || data.referenceType === 'sale');
    // If amount is negative? Payment usually positive in DB but direction depends on context.
    // In `PaymentsService`, sale payment (incoming) is positive amount. Purchase payment (outgoing) is positive amount.
    // We need to distinguish based on context.
    // Actually `Payment` table doesn't explicitly say "Incoming" or "Outgoing" except by context (referenceType=sale -> Incoming, referenceType=purchase -> Outgoing).

    let title = 'Payment Voucher';
    let titleAr = 'سند صرف';

    if (data.referenceType === 'sale' || (data.partyType === 'customer' && !data.referenceType)) {
        title = 'Receipt Voucher';
        titleAr = 'سند قبض';
    }

    return {
        meta: {
            ...meta,
            title,
            titleAr,
        },
        pageOrientation: 'portrait',
        summaryItems: [
            { label: 'Payment No', labelAr: 'رقم السند', value: data.paymentNumber },
            { label: 'Date', labelAr: 'التاريخ', value: data.date },
            { label: 'Amount', labelAr: 'المبلغ', value: data.amount, format: 'currency', bold: true },
            { label: 'Method', labelAr: 'طريقة الدفع', value: data.method },
            { label: 'Party', labelAr: 'الطرف', value: data.partyName || '-' },
            { label: 'Reference', labelAr: 'المرجع', value: data.referenceNumber || (data.referenceType ? `${data.referenceType} #${data.referenceId}` : '-') },
            { label: 'Received By', labelAr: 'المستلم/المسلم', value: data.receivedBy },
            { label: 'Branch', labelAr: 'الفرع', value: data.branchName || '-' },
            { label: 'Notes', labelAr: 'ملاحظات', value: data.notes || '-' },
            { label: 'Status', labelAr: 'الحالة', value: data.status },
        ]
    };
}
