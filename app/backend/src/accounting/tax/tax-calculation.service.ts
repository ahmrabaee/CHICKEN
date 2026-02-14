import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TaxResult, TaxTemplateItemForCalc } from './types/tax.types';

/**
 * Blueprint 05: Tax calculation engine
 * Charge types: on_net_total, on_previous_row_amount, on_previous_row_total, actual
 */
@Injectable()
export class TaxCalculationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get ordered tax items for a template
   */
  async getOrderedTaxItems(templateId: number): Promise<TaxTemplateItemForCalc[]> {
    const items = await this.prisma.taxTemplateItem.findMany({
      where: { templateId },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    return items.map((it) => ({
      accountId: it.accountId,
      rate: it.rate,
      chargeType: it.chargeType as TaxTemplateItemForCalc['chargeType'] | 'on_net_total',
      rowId: it.rowId,
      fixedAmount: it.fixedAmount,
      displayOrder: it.displayOrder,
    }));
  }

  /**
   * Calculate taxes for a given net total
   */
  async calculateTaxes(
    templateId: number,
    netTotal: number,
    precision: number = 2,
  ): Promise<TaxResult[]> {
    const items = await this.getOrderedTaxItems(templateId);
    const results: TaxResult[] = [];
    const divisor = Math.pow(10, precision);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let amount = 0;

      switch (item.chargeType) {
        case 'on_net_total':
          amount = Math.round((netTotal * item.rate) / 10000);
          break;
        case 'on_previous_row_amount': {
          const rowIdx = (item.rowId ?? 1) - 1;
          const prev = results[rowIdx];
          amount = prev ? Math.round((prev.amount * item.rate) / 10000) : 0;
          break;
        }
        case 'on_previous_row_total': {
          const rowIdx = (item.rowId ?? 1) - 1;
          const prevTotal = netTotal + results.slice(0, rowIdx + 1).reduce((s, r) => s + r.amount, 0);
          amount = Math.round((prevTotal * item.rate) / 10000);
          break;
        }
        case 'actual':
          amount = item.fixedAmount ?? 0;
          break;
        default:
          amount = Math.round((netTotal * item.rate) / 10000);
      }

      results.push({ accountId: item.accountId, rate: item.rate, amount });
    }

    return results;
  }
}
