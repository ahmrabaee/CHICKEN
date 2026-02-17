
export interface PaymentPdfData {
    paymentNumber: string;
    date: string;
    amount: number;
    method: string;
    partyName?: string;
    partyType?: string;
    referenceType?: string;
    referenceId?: number;
    referenceNumber?: string; // saleNumber or purchaseNumber
    receivedBy: string;
    branchName?: string;
    notes?: string;
    status: string;
    isVoided: boolean;
}
