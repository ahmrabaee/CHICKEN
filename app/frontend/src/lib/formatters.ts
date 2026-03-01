/**
 * Shared formatting utilities
 */

/**
 * Safely coerce any value to a finite number.
 * Returns 0 for null / undefined / NaN / Infinity / non-numeric strings.
 */
export function toMoneyNumber(v: unknown): number {
    if (v === null || v === undefined) return 0;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("[money] toMoneyNumber: non-finite value", v);
        }
        return 0;
    }
    return n;
}

/**
 * Compute canonical { original, remaining } from a raw debt object.
 * Accepts multiple possible field names to stay robust against API drift.
 */
export function computeDebtNumbers(debt: Record<string, unknown>): {
    original: number;
    remaining: number;
} {
    const original = toMoneyNumber(
        debt.originalAmount ?? debt.totalAmount ?? debt.amount ?? 0,
    );
    const paid = toMoneyNumber(
        debt.paidAmount ?? debt.amountPaid ?? debt.paid ?? 0,
    );
    // "remaining" sent directly by the API always wins if present
    const remaining = debt.remainingAmount !== undefined
        ? toMoneyNumber(debt.remainingAmount)
        : Math.max(0, original - paid);
    return { original, remaining };
}

/** Format an integer minor unit value (e.g. agoras) as currency. NaN-safe. */
export function formatCurrency(v: unknown): string {
    const n = toMoneyNumber(v);
    return `₪ ${(n / 100).toFixed(2)}`;
}

/** Format an ISO date string in Arabic locale */
export function formatDate(d: string): string {
    return new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}
