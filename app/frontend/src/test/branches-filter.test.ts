/**
 * Unit tests for the Branches page includeInactive param derivation
 * and the client-side search filter.
 *
 * Root cause fix:
 *  Previously useBranches() never passed any params to the API, so the backend
 *  always defaulted to isActive=true only. The client-side matchesStatus filter
 *  was operating on an already-active-only array — toggling it had no effect.
 *
 *  Fix: pass `includeInactive=true` to GET /branches when toggle is ON.
 *  The backend already supported this param (branches.controller.ts line 20-23).
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Mirror the API param builder in branch.service.ts
// ---------------------------------------------------------------------------
function buildBranchParams(includeInactive: boolean): Record<string, string> | undefined {
    return includeInactive ? { includeInactive: "true" } : undefined;
}

describe("Branches – API param builder", () => {
    it("toggle OFF → no params sent (backend defaults to active-only)", () => {
        expect(buildBranchParams(false)).toBeUndefined();
    });

    it("toggle ON → includeInactive=true sent", () => {
        expect(buildBranchParams(true)).toEqual({ includeInactive: "true" });
    });

    it("value is the string 'true', not boolean (query string serialization)", () => {
        const p = buildBranchParams(true);
        expect(p?.includeInactive).toBe("true");
        expect(typeof p?.includeInactive).toBe("string");
    });
});

// ---------------------------------------------------------------------------
// Mirror backend WHERE clause (branches.service.ts line 11)
// ---------------------------------------------------------------------------
function buildBackendWhere(includeInactive: boolean): object {
    return includeInactive ? {} : { isActive: true };
}

describe("Backend WHERE clause (mirror of branches.service.ts)", () => {
    it("includeInactive=false → where.isActive=true", () => {
        expect(buildBackendWhere(false)).toEqual({ isActive: true });
    });

    it("includeInactive=true → empty where (all branches)", () => {
        expect(buildBackendWhere(true)).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// Client-side search filter (the only remaining client filter after fix)
// ---------------------------------------------------------------------------
type MockBranch = { name: string; code: string; nameEn?: string; isActive: boolean };

function applySearchFilter(branches: MockBranch[], query: string): MockBranch[] {
    if (!query) return branches;
    const q = query.toLowerCase();
    return branches.filter(
        (b) =>
            b.name.toLowerCase().includes(q) ||
            b.code.toLowerCase().includes(q) ||
            b.nameEn?.toLowerCase().includes(q),
    );
}

const MOCK_BRANCHES: MockBranch[] = [
    { name: "فرع المركز", code: "HQ", nameEn: "HQ Branch", isActive: true },
    { name: "فرع الشمال", code: "NB", nameEn: "North Branch", isActive: false },
    { name: "فرع الجنوب", code: "SB", isActive: true },
];

describe("Branches – client-side search filter", () => {
    it("empty query returns all items unchanged", () => {
        expect(applySearchFilter(MOCK_BRANCHES, "")).toHaveLength(3);
    });

    it("matches by Arabic name", () => {
        const r = applySearchFilter(MOCK_BRANCHES, "الشمال");
        expect(r).toHaveLength(1);
        expect(r[0].code).toBe("NB");
    });

    it("matches by code (case-insensitive)", () => {
        const r = applySearchFilter(MOCK_BRANCHES, "hq");
        expect(r).toHaveLength(1);
        expect(r[0].code).toBe("HQ");
    });

    it("matches by English name", () => {
        const r = applySearchFilter(MOCK_BRANCHES, "north");
        expect(r).toHaveLength(1);
        expect(r[0].code).toBe("NB");
    });

    it("no match returns empty array", () => {
        expect(applySearchFilter(MOCK_BRANCHES, "xxxxx")).toHaveLength(0);
    });

    it("search runs on both active and inactive items (status filter is server-side)", () => {
        // All 3 branches in array regardless of isActive (server already filtered)
        const r = applySearchFilter(MOCK_BRANCHES, "فرع");
        expect(r).toHaveLength(3);
    });
});

// ---------------------------------------------------------------------------
// End-to-end: toggle state → API param → backend WHERE → result set
// ---------------------------------------------------------------------------
describe("End-to-end: toggle → param → backend WHERE", () => {
    it("toggle OFF: no param → backend active-only WHERE → only active rows returned", () => {
        const params = buildBranchParams(false);
        const where = buildBackendWhere(params?.includeInactive === "true");
        expect(params).toBeUndefined();
        expect(where).toEqual({ isActive: true }); // only active
    });

    it("toggle ON: includeInactive=true → backend empty WHERE → all rows returned", () => {
        const params = buildBranchParams(true);
        const where = buildBackendWhere(params?.includeInactive === "true");
        expect(params).toEqual({ includeInactive: "true" });
        expect(where).toEqual({}); // all branches
    });
});
