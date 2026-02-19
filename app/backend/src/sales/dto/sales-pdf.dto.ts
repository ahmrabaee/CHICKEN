
export interface SaleInvoicePdfData {
    saleNumber: string;
    saleDate: string;
    customerName?: string;
    customerPhone?: string;
    cashierName: string;
    branchName: string;
    items: {
        name: string;
        quantity: number;      // grams -> kg
        unitPrice: number;
        total: number;
    }[];
    subtotal: number;
    discount: number;
    taxAmount: number;
    totalAmount: number;
    paidAmount: number;
    balanceDue: number;
    payments: { method: string; amount: number; date: string }[];
    isVoided: boolean;
    voidReason?: string;
}
