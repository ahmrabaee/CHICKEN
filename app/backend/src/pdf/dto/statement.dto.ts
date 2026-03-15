
export interface StatementTransaction {
    date: string;
    type: string;
    reference: string;
    debit: number;   // Increase in balance (Invoice)
    credit: number;  // Decrease in balance (Payment)
    balance: number; // Running balance
    notes?: string;
}

export interface StatementPdfData {
    partyName: string;
    partyNumber?: string;     // customerNumber / supplierNumber
    partyAddress?: string;
    partyPhone?: string;
    partyTaxNumber?: string;
    startDate: string;
    endDate: string;
    openingBalance: number;
    totalDebits: number;
    totalCredits: number;
    closingBalance: number;
    transactions: StatementTransaction[];
    /** When true: no movements in period; show empty state message */
    isEmpty?: boolean;
}
