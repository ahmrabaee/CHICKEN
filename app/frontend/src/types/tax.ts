/**
 * Blueprint 05: Tax Engine types
 */

export interface TaxTemplateItem {
    id: number;
    templateId: number;
    accountId: number;
    rate: number;
    chargeType: string;
    rowId?: number | null;
    fixedAmount?: number | null;
    isDeductible?: boolean;
    displayOrder: number;
    account?: { id: number; code: string; name: string };
}

export interface TaxTemplate {
    id: number;
    name: string;
    type: 'sales' | 'purchases';
    companyId?: number | null;
    isActive: boolean;
    items: TaxTemplateItem[];
}

export interface VATReport {
    outputVat: number;
    inputVat: number;
    netVatPayable: number;
    byAccount: {
        accountId: number;
        accountCode: string;
        accountName: string;
        output: number;
        input: number;
    }[];
    byRate: { rate: number; output: number; input: number }[];
}

export interface CreateTaxTemplateDto {
    name: string;
    type: 'sales' | 'purchases';
    companyId?: number;
    items: Array<{
        accountId: number;
        rate: number;
        chargeType?: string;
        rowId?: number;
        fixedAmount?: number;
        displayOrder?: number;
    }>;
}
