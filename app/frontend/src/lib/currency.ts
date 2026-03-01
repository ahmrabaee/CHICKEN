/**
 * Safely coerce any value to a finite number.
 * Returns 0 for undefined / null / NaN / empty string / non-numeric string.
 *
 * @example
 *   toNumber(undefined)    // 0
 *   toNumber(null)         // 0
 *   toNumber("")           // 0
 *   toNumber("12100.00")   // 12100
 *   toNumber(NaN)          // 0
 */
export function toNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Format minor-unit integers (e.g. 12100 → "₪ 121.00") safely.
 * Never returns "NaN" — any invalid input is treated as 0.
 */
export function formatCurrency(minorUnits: unknown): string {
    return `₪ ${(toNumber(minorUnits) / 100).toFixed(2)}`;
}

/**
 * Compute a safe "remaining" amount (in minor units).
 * - Uses `amountDue` when it is not null/undefined.
 * - Falls back to max(0, grandTotal - amountPaid) so the result is never negative.
 * - All inputs are coerced through toNumber() so undefined/null/string all work.
 */
export function safeRemaining(
    amountDue: unknown,
    grandTotal: unknown,
    amountPaid: unknown
): number {
    return amountDue != null
        ? toNumber(amountDue)
        : Math.max(0, toNumber(grandTotal) - toNumber(amountPaid));
}
