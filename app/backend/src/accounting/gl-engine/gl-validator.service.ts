import { BadRequestException, Injectable } from '@nestjs/common';
import { GLMapEntry } from './types/gl-map.types';

/**
 * GL Validator - Blueprint 02
 * Validates balance, tolerance, and determines if round-off is needed
 */
@Injectable()
export class GlValidatorService {
  /**
   * Tolerance in minor units (fils/cents).
   * JE/Payment: 5 minor units (e.g. 0.05 when precision=2)
   * Others: 0.5 in currency = 50 minor units when precision=2
   */
  getDebitCreditAllowance(voucherType: string, precision: number): number {
    if (['journal_entry', 'journal entry', 'payment', 'reversal'].includes(voucherType.toLowerCase())) {
      return 5; // 5 minor units
    }
    return Math.round(0.5 * Math.pow(10, precision)); // 0.5 in currency
  }

  /**
   * Validate balance and determine if round-off is needed
   * @returns { diff, needsRoundOff }
   * @throws BadRequestException if |diff| > allowance
   */
  validateBalance(
    glMap: GLMapEntry[],
    precision: number,
    voucherType: string,
  ): { diff: number; needsRoundOff: boolean } {
    const totalDebit = glMap.reduce((s, e) => s + (e.debit ?? 0), 0);
    const totalCredit = glMap.reduce((s, e) => s + (e.credit ?? 0), 0);
    const diff = totalDebit - totalCredit;

    const allowance = this.getDebitCreditAllowance(voucherType, precision);
    if (Math.abs(diff) > allowance) {
      throw new BadRequestException({
        code: 'UNBALANCED_ENTRY',
        diff,
        totalDebit,
        totalCredit,
        message: `Unbalanced entry: Debit=${totalDebit}, Credit=${totalCredit}, diff=${diff}`,
        messageAr: 'القيد غير متوازن',
      });
    }

    const threshold = 1; // 1 minor unit
    return { diff, needsRoundOff: Math.abs(diff) >= threshold };
  }
}
