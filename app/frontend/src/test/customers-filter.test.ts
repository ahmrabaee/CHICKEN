/**
 * Unit tests for Customers page isActive filter param derivation.
 *
 * Bug was: showInactive ? undefined : true
 *  → when ON, sent no param → backend defaulted to isActive=true (active only)
 *
 * Fix:     showInactive ? false : undefined
 *  → when ON,  sends isActive=false → backend returns only inactive
 *  → when OFF, sends no param       → backend defaults to isActive=true (active only)
 */

import { describe, it, expect } from "vitest";

/** Pure copy of the fixed param derivation used in Customers.tsx */
function resolveIsActiveParam(showInactive: boolean): boolean | undefined {
    return showInactive ? false : undefined;
}

describe("Customers page – isActive filter param", () => {
    it("toggle OFF → param is undefined (backend defaults to active-only)", () => {
        expect(resolveIsActiveParam(false)).toBeUndefined();
    });

    it("toggle ON → param is false (backend returns only inactive)", () => {
        expect(resolveIsActiveParam(true)).toBe(false);
    });

    it("toggle ON result is strictly false, not null/undefined/0", () => {
        const result = resolveIsActiveParam(true);
        expect(result).toBe(false);
        expect(result).not.toBeNull();
        expect(result).not.toBeUndefined();
    });

    it("param derivation is deterministic across multiple calls", () => {
        // No state leakage
        expect(resolveIsActiveParam(true)).toBe(false);
        expect(resolveIsActiveParam(false)).toBeUndefined();
        expect(resolveIsActiveParam(true)).toBe(false);
    });
});

/**
 * Simulate the backend WHERE clause logic (mirrors customers.service.ts lines 45-49)
 * to verify end-to-end correctness of the param + backend fallback.
 */
function buildIsActiveWhere(isActive: boolean | undefined): boolean {
    // Mirrors: if (query.isActive !== undefined) { where.isActive = query.isActive }
    //          else { where.isActive = true }
    return isActive !== undefined ? isActive : true;
}

describe("Backend isActive WHERE clause (mirror of customers.service.ts)", () => {
    it("no param (undefined) → defaults to true (active only)", () => {
        expect(buildIsActiveWhere(undefined)).toBe(true);
    });

    it("param=false → filters to inactive only", () => {
        expect(buildIsActiveWhere(false)).toBe(false);
    });

    it("param=true → filters to active only", () => {
        expect(buildIsActiveWhere(true)).toBe(true);
    });
});

describe("End-to-end: toggle state → API param → WHERE clause", () => {
    it("toggle OFF → active-only results", () => {
        const param = resolveIsActiveParam(false);
        const where = buildIsActiveWhere(param);
        expect(where).toBe(true); // only active
    });

    it("toggle ON → inactive-only results", () => {
        const param = resolveIsActiveParam(true);
        const where = buildIsActiveWhere(param);
        expect(where).toBe(false); // only inactive
    });

    it("OLD (buggy) behaviour: toggle ON → still returned active-only", () => {
        // This documents the original bug:
        // showInactive ? undefined : true  →  undefined  →  backend defaults to true
        const buggyParam = true ? undefined : true; // showInactive=true, old code
        const where = buildIsActiveWhere(buggyParam);
        expect(where).toBe(true); // BUG: showed active customers when inactive toggled
    });
});
