
export interface PurchaseOrderPdfData {
    purchaseNumber: string;
    purchaseDate: string;
    dueDate?: string;
    supplierName: string;
    supplierPhone?: string;
    items: {
        itemName: string;
        itemCode: string;
        quantity: number;      // grams -> kg
        unitPrice: number;
        total: number;
    }[];
    taxAmount: number;
    totalAmount: number;
    paymentStatus: string;
    amountPaid: number;
    balanceDue: number;
    notes?: string;
}
