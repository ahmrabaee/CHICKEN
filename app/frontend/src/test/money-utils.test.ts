/**
 * Unit tests for shared money utilities in lib/formatters.ts
 * Covers: toMoneyNumber, computeDebtNumbers, formatCurrency
 */

import { describe, it, expect } from "vitest";
import { toMoneyNumber, computeDebtNumbers, formatCurrency } from "../lib/formatters";

// ---------------------------------------------------------------------------
// toMoneyNumber
// ---------------------------------------------------------------------------
describe("toMoneyNumber", () => {
    it("returns 0 for undefined", () => expect(toMoneyNumber(undefined)).toBe(0));
    it("returns 0 for null", () => expect(toMoneyNumber(null)).toBe(0));
    it("returns 0 for empty string", () => expect(toMoneyNumber("")).toBe(0));
    it("returns 0 for NaN", () => expect(toMoneyNumber(Number.NaN)).toBe(0));
    it("returns 0 for Infinity", () => expect(toMoneyNumber(Infinity)).toBe(0));
    it("returns 0 for -Infinity", () => expect(toMoneyNumber(-Infinity)).toBe(0));
    it("returns 0 for a non-numeric string", () => expect(toMoneyNumber("abc")).toBe(0));
    it("parses a numeric string", () => expect(toMoneyNumber("12100")).toBe(12100));
    it("parses a decimal string", () => expect(toMoneyNumber("12100.00")).toBe(12100));
    it("passes through a valid number", () => expect(toMoneyNumber(5000)).toBe(5000));
    it("handles negative numbers", () => expect(toMoneyNumber(-200)).toBe(-200));
});

// ---------------------------------------------------------------------------
// computeDebtNumbers
// ---------------------------------------------------------------------------
describe("computeDebtNumbers", () => {
    it("returns zeros for empty object", () => {
        const r = computeDebtNumbers({});
        expect(r.original).toBe(0);
        expect(r.remaining).toBe(0);
    });

    it("uses originalAmount when present", () => {
        const r = computeDebtNumbers({ originalAmount: 10000 });
        expect(r.original).toBe(10000);
    });

    it("falls back to totalAmount when originalAmount absent", () => {
        const r = computeDebtNumbers({ totalAmount: 8000 });
        expect(r.original).toBe(8000);
    });

    it("falls back to amount as last resort", () => {
        const r = computeDebtNumbers({ amount: 5000 });
        expect(r.original).toBe(5000);
    });

    it("computes remaining as original - paid", () => {
        const r = computeDebtNumbers({ originalAmount: 10000, amountPaid: 3000 });
        expect(r.remaining).toBe(7000);
    });

    it("uses paidAmount alias", () => {
        const r = computeDebtNumbers({ originalAmount: 10000, paidAmount: 4000 });
        expect(r.remaining).toBe(6000);
    });

    it("uses paid alias", () => {
        const r = computeDebtNumbers({ originalAmount: 10000, paid: 2000 });
        expect(r.remaining).toBe(8000);
    });

    it("clamps remaining to 0 when paid > original", () => {
        const r = computeDebtNumbers({ originalAmount: 5000, amountPaid: 9000 });
        expect(r.remaining).toBe(0);
    });

    it("honours direct remainingAmount from backend", () => {
        const r = computeDebtNumbers({ originalAmount: 10000, amountPaid: 1000, remainingAmount: 9999 });
        expect(r.remaining).toBe(9999); // backend value wins
    });

    it("handles null originalAmount gracefully", () => {
        const r = computeDebtNumbers({ originalAmount: null, amountPaid: 0 });
        expect(r.original).toBe(0);
        expect(r.remaining).toBe(0);
    });

    it("handles undefined paid gracefully (defaults to 0)", () => {
        const r = computeDebtNumbers({ originalAmount: 5000 });
        expect(r.remaining).toBe(5000);
    });

    it("parses string amounts coming from API", () => {
        const r = computeDebtNumbers({ totalAmount: "12100.00" as any, amountPaid: "100.00" as any });
        expect(r.original).toBe(12100);
        expect(r.remaining).toBe(12000);
    });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------
describe("formatCurrency", () => {
    it("formats integer minor units correctly", () => {
        expect(formatCurrency(10000)).toBe("₪ 100.00");
    });

    it("never returns NaN for undefined", () => {
        const result = formatCurrency(undefined);
        expect(result).not.toContain("NaN");
        expect(result).toBe("₪ 0.00");
    });

    it("never returns NaN for null", () => {
        const result = formatCurrency(null);
        expect(result).not.toContain("NaN");
    });

    it("handles 0 correctly", () => {
        expect(formatCurrency(0)).toBe("₪ 0.00");
    });

    it("handles negative values", () => {
        expect(formatCurrency(-500)).toBe("₪ -5.00");
    });
});
