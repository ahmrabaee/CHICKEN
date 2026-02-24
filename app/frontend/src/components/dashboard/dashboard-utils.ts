import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { URLSearchParamsInit } from "react-router-dom";
import type {
  DashboardDateRange,
  DashboardDatePreset,
  DashboardDebtRow,
  DashboardFilters,
  DashboardLowStockRow,
  DashboardTrendDirection,
  SalesChartPoint,
} from "@/components/dashboard/types";
import type { SalesReport } from "@/types/reports";

const DATE_FORMAT = "yyyy-MM-dd";

function toDateString(value: Date): string {
  return format(value, DATE_FORMAT);
}

function parseDateValue(value?: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function getPresetDateRange(
  preset: DashboardDatePreset,
  baseDate = new Date(),
): DashboardDateRange {
  const now = endOfDay(baseDate);
  if (preset === "today") {
    return {
      startDate: toDateString(startOfDay(now)),
      endDate: toDateString(now),
    };
  }

  if (preset === "week") {
    return {
      startDate: toDateString(startOfWeek(now, { weekStartsOn: 6 })),
      endDate: toDateString(endOfWeek(now, { weekStartsOn: 6 })),
    };
  }

  if (preset === "month") {
    return {
      startDate: toDateString(startOfMonth(now)),
      endDate: toDateString(endOfMonth(now)),
    };
  }

  return {
    startDate: toDateString(startOfDay(now)),
    endDate: toDateString(now),
  };
}

export function getDefaultDashboardFilters(): DashboardFilters {
  const preset = "today" as const;
  const range = getPresetDateRange(preset);
  return {
    range: preset,
    startDate: range.startDate,
    endDate: range.endDate,
    search: "",
  };
}

export function normalizeDashboardFilters(filters: DashboardFilters): DashboardFilters {
  const cleanSearch = filters.search.trimStart();
  if (filters.range !== "custom") {
    const presetRange = getPresetDateRange(filters.range);
    return {
      ...filters,
      startDate: presetRange.startDate,
      endDate: presetRange.endDate,
      search: cleanSearch,
    };
  }

  const start = parseDateValue(filters.startDate);
  const end = parseDateValue(filters.endDate);
  if (!start || !end) {
    const fallback = getPresetDateRange("today");
    return {
      ...filters,
      range: "today",
      startDate: fallback.startDate,
      endDate: fallback.endDate,
      search: cleanSearch,
    };
  }

  if (start > end) {
    return {
      ...filters,
      startDate: toDateString(startOfDay(end)),
      endDate: toDateString(endOfDay(start)),
      search: cleanSearch,
    };
  }

  return {
    ...filters,
    startDate: toDateString(startOfDay(start)),
    endDate: toDateString(endOfDay(end)),
    search: cleanSearch,
  };
}

function parseRangeParam(value: string | null): DashboardDatePreset {
  if (value === "today" || value === "week" || value === "month" || value === "custom") {
    return value;
  }
  return "today";
}

export function parseDashboardFilters(params: URLSearchParams): DashboardFilters {
  const defaults = getDefaultDashboardFilters();
  const parsed: DashboardFilters = {
    ...defaults,
    range: parseRangeParam(params.get("range")),
    startDate: params.get("start") ?? defaults.startDate,
    endDate: params.get("end") ?? defaults.endDate,
    search: params.get("q") ?? "",
  };

  const branchId = asNumber(params.get("branch"));
  if (branchId && branchId > 0) {
    parsed.branchId = branchId;
  }

  return normalizeDashboardFilters(parsed);
}

export function buildDashboardSearchParams(filters: DashboardFilters): URLSearchParamsInit {
  const normalized = normalizeDashboardFilters(filters);
  const params = new URLSearchParams();
  params.set("range", normalized.range);
  params.set("start", normalized.startDate);
  params.set("end", normalized.endDate);
  if (normalized.branchId) params.set("branch", String(normalized.branchId));
  if (normalized.search.trim().length > 0) params.set("q", normalized.search.trim());
  return params;
}

export function getPreviousDateRange(range: DashboardDateRange): DashboardDateRange {
  const start = parseDateValue(range.startDate) ?? startOfDay(new Date());
  const end = parseDateValue(range.endDate) ?? endOfDay(new Date());
  const days = Math.max(1, differenceInCalendarDays(end, start) + 1);
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(days - 1));
  return {
    startDate: toDateString(startOfDay(previousStart)),
    endDate: toDateString(endOfDay(previousEnd)),
  };
}

export function getRangeLabel(range: DashboardDateRange): string {
  const start = parseDateValue(range.startDate);
  const end = parseDateValue(range.endDate);
  if (!start || !end) return "-";
  return `${format(start, "yyyy/MM/dd")} - ${format(end, "yyyy/MM/dd")}`;
}

export function getDelta(current: number, previous: number): {
  direction: DashboardTrendDirection;
  pct: number | null;
} {
  if (current === 0 && previous === 0) {
    return { direction: "flat", pct: 0 };
  }
  if (previous === 0) {
    return { direction: current > 0 ? "up" : "flat", pct: 100 };
  }

  const diff = current - previous;
  const pct = (diff / Math.abs(previous)) * 100;
  if (diff > 0) return { direction: "up", pct };
  if (diff < 0) return { direction: "down", pct: Math.abs(pct) };
  return { direction: "flat", pct: 0 };
}

export function isDateInsideRange(
  value: string | undefined,
  range: DashboardDateRange,
): boolean {
  if (!value) return false;
  const date = parseDateValue(value);
  const start = parseDateValue(range.startDate);
  const end = parseDateValue(range.endDate);
  if (!date || !start || !end) return false;
  return date >= startOfDay(start) && date <= endOfDay(end);
}

export function mapDebtRow(raw: unknown): DashboardDebtRow | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = asNumber(record.id);
  if (!id) return null;

  const directionRaw =
    asString(record.direction) ?? asString(record.debtType) ?? "receivable";
  const direction = directionRaw === "payable" ? "payable" : "receivable";

  const totalAmount = asNumber(record.totalAmount) ?? asNumber(record.originalAmount) ?? 0;
  const amountPaid = asNumber(record.amountPaid) ?? asNumber(record.paidAmount) ?? 0;
  const outstandingAmount = Math.max(
    0,
    asNumber(record.remainingAmount) ?? totalAmount - amountPaid,
  );

  const partyName =
    asString(record.partyName) ??
    asString(record.customerName) ??
    asString(record.supplierName) ??
    asString(record.name) ??
    "—";

  return {
    id,
    debtNumber: asString(record.debtNumber),
    direction,
    partyName,
    partyPhone: asString(record.customerPhone) ?? asString(record.phone),
    sourceType: asString(record.sourceType),
    sourceId: asNumber(record.sourceId),
    saleNumber: asString(record.saleNumber),
    purchaseNumber: asString(record.purchaseNumber),
    totalAmount,
    amountPaid,
    outstandingAmount,
    status: asString(record.status) ?? "open",
    dueDate: asString(record.dueDate),
    createdAt: asString(record.createdAt),
    branchId: asNumber(record.branchId),
  };
}

export function mapLowStockRow(raw: unknown): DashboardLowStockRow | null {
  const record = asRecord(raw);
  if (!record) return null;

  const itemId = asNumber(record.itemId) ?? asNumber(record.id);
  if (!itemId) return null;

  const currentQuantityGrams =
    asNumber(record.currentQuantityGrams) ?? asNumber(record.totalQuantity) ?? 0;
  const minStockLevelGrams =
    asNumber(record.minStockLevel) ?? asNumber(record.minStockLevelGrams) ?? 0;
  const availableQuantityGrams =
    asNumber(record.availableQuantityGrams) ??
    asNumber(record.availableQuantity) ??
    currentQuantityGrams;

  return {
    itemId,
    itemCode: asString(record.itemCode) ?? asString(record.code) ?? `ITEM-${itemId}`,
    itemName: asString(record.itemName) ?? asString(record.name) ?? "—",
    categoryName: asString(record.categoryName) ?? "غير مصنف",
    branchId: asNumber(record.branchId),
    branchName: asString(record.branchName),
    currentQuantityGrams,
    minStockLevelGrams,
    availableQuantityGrams,
  };
}

export function buildSalesChartData(
  salesRows: SalesReport["sales"] | undefined,
): SalesChartPoint[] {
  const source = salesRows ?? [];
  if (source.length === 0) return [];

  const bucket = new Map<string, SalesChartPoint>();
  for (const row of source) {
    const dateObj = parseDateValue(row.date);
    if (!dateObj) continue;
    const dayKey = toDateString(dateObj);
    const dayLabel = format(dateObj, "dd/MM");
    const existing = bucket.get(dayKey) ?? {
      dayKey,
      dayLabel,
      revenue: 0,
      profit: 0,
      orders: 0,
    };
    existing.revenue += row.total;
    existing.profit += row.profit;
    existing.orders += 1;
    bucket.set(dayKey, existing);
  }

  return Array.from(bucket.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): void {
  const escapeCell = (value: string | number): string => {
    const raw = String(value ?? "");
    if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
      return `"${raw.replace(/"/g, "\"\"")}"`;
    }
    return raw;
  };

  const content = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\n");

  const blob = new Blob([`\uFEFF${content}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function gramsToKg(grams: number): string {
  return `${(grams / 1000).toFixed(2)} كجم`;
}
