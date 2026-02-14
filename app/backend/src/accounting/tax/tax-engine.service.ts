import { Injectable } from '@nestjs/common';
import { TaxCalculationService } from './tax-calculation.service';
import { TaxResult } from './types/tax.types';
import { GLMapEntry } from '../gl-engine/types/gl-map.types';

/**
 * Blueprint 05: Tax Engine - converts tax rows to GL entries
 * Sales: Credit VAT Payable (liability increase)
 * Purchases: Debit VAT Receivable (asset increase - input tax)
 */
@Injectable()
export class TaxEngineService {
  constructor(private taxCalculationService: TaxCalculationService) {}

  /**
   * Convert tax results to GL Map entries for Sales
   * Each tax: Credit to VAT Payable (output tax)
   */
  getTaxGLEntriesForSales(taxResults: TaxResult[]): GLMapEntry[] {
    return taxResults
      .filter((r) => r.amount > 0)
      .map((r) => ({
        accountId: r.accountId,
        credit: r.amount,
        description: `VAT ${r.rate / 100}%`,
      }));
  }

  /**
   * Convert tax results to GL Map entries for Purchases
   * Each tax: Debit to VAT Receivable (input tax - deductible)
   */
  getTaxGLEntriesForPurchases(taxResults: TaxResult[]): GLMapEntry[] {
    return taxResults
      .filter((r) => r.amount > 0)
      .map((r) => ({
        accountId: r.accountId,
        debit: r.amount,
        description: `Input VAT ${r.rate / 100}%`,
      }));
  }

  /**
   * Calculate taxes and return GL entries for sales
   */
  async getSalesTaxGLEntries(templateId: number, netTotal: number, precision: number = 2): Promise<GLMapEntry[]> {
    const results = await this.taxCalculationService.calculateTaxes(templateId, netTotal, precision);
    return this.getTaxGLEntriesForSales(results);
  }

  /**
   * Calculate taxes and return GL entries for purchases
   */
  async getPurchaseTaxGLEntries(templateId: number, netTotal: number, precision: number = 2): Promise<GLMapEntry[]> {
    const results = await this.taxCalculationService.calculateTaxes(templateId, netTotal, precision);
    return this.getTaxGLEntriesForPurchases(results);
  }
}
