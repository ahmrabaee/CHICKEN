/**
 * Blueprint 05: Tax Engine types
 */

export interface TaxResult {
  accountId: number;
  rate: number;
  amount: number;
}

export type ChargeType =
  | 'on_net_total'
  | 'on_previous_row_amount'
  | 'on_previous_row_total'
  | 'actual';

export interface TaxTemplateItemForCalc {
  accountId: number;
  rate: number;
  chargeType: ChargeType;
  rowId: number | null;
  fixedAmount: number | null;
  displayOrder: number;
}

export interface VATReport {
  outputVat: number;
  inputVat: number;
  netVatPayable: number;
  byAccount: { accountId: number; accountCode: string; accountName: string; output: number; input: number }[];
  byRate: { rate: number; output: number; input: number }[];
}
