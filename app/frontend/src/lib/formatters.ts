/**
 * Shared formatting utilities
 */

/** Format an integer minor unit value (e.g. agoras) as currency */
export function formatCurrency(v: number): string {
    return `₪ ${(v / 100).toFixed(2)}`;
}

/** Format an ISO date string in Arabic locale */
export function formatDate(d: string): string {
    return new Date(d).toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}
