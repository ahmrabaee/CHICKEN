import { describe, it, expect } from "vitest";
import { toNumber, safeRemaining } from "@/lib/currency";

// ─── toNumber() helper ──────────────────────────────────────────────────────

describe("toNumber()", () => {
    it("returns the number for a plain integer", () => {
        expect(toNumber(12100)).toBe(12100);
    });

    it("parses a numeric string", () => {
        expect(toNumber("12100.00")).toBe(12100);
    });

    it("returns 0 for undefined", () => {
        expect(toNumber(undefined)).toBe(0);
    });

    it("returns 0 for null", () => {
        expect(toNumber(null)).toBe(0);
    });

    it("returns 0 for an empty string", () => {
        expect(toNumber("")).toBe(0);
    });

    it("returns 0 for NaN", () => {
        expect(toNumber(NaN)).toBe(0);
    });

    it("returns 0 for a non-numeric string", () => {
        expect(toNumber("abc")).toBe(0);
    });

    it("handles negative numbers correctly", () => {
        expect(toNumber(-500)).toBe(-500);
    });
});

// ─── Safe remaining calculation – المتبقي ─────────────────────────────────

describe("safeRemaining() – المتبقي calculation", () => {
    it("uses amountDue when it is a valid number", () => {
        expect(safeRemaining(5000, 20000, 15000)).toBe(5000);
    });

    it("falls back to grandTotal - amountPaid when amountDue is null", () => {
        expect(safeRemaining(null, 20000, 15000)).toBe(5000);
    });

    it("falls back to grandTotal - amountPaid when amountDue is undefined", () => {
        expect(safeRemaining(undefined, 20000, 15000)).toBe(5000);
    });

    it("clamps to 0 when paid > total (no negative remaining)", () => {
        expect(safeRemaining(null, 10000, 15000)).toBe(0);
    });

    it("returns 0 when all inputs are undefined (fully missing data)", () => {
        expect(safeRemaining(undefined, undefined, undefined)).toBe(0);
    });

    it("handles string amounts when amountDue is a numeric string", () => {
        expect(safeRemaining("5000", 20000, 15000)).toBe(5000);
    });

    it("handles string amounts in grandTotal / amountPaid", () => {
        expect(safeRemaining(null, "20000", "15000")).toBe(5000);
    });

    it("returns 0 when paid equals total (fully settled)", () => {
        expect(safeRemaining(null, 10000, 10000)).toBe(0);
    });
});
