import type { LucideIcon } from "lucide-react";

export type DashboardDatePreset = "today" | "week" | "month" | "custom";
export type DashboardTrendDirection = "up" | "down" | "flat";

export interface DashboardFilters {
  range: DashboardDatePreset;
  startDate: string;
  endDate: string;
  branchId?: number;
  search: string;
}

export interface DashboardDateRange {
  startDate: string;
  endDate: string;
}

export interface DashboardKpiDetail {
  label: string;
  value: string;
}

export interface DashboardKpiItem {
  key: string;
  title: string;
  value: string;
  rawValue: number;
  icon: LucideIcon;
  tone: "default" | "success" | "warning" | "danger" | "info";
  deltaPct: number | null;
  deltaDirection: DashboardTrendDirection;
  subtitle: string;
  size?: "default" | "wide";
  details: DashboardKpiDetail[];
  actionLabel?: string;
  actionTo?: string;
}

export interface DashboardDebtRow {
  id: number;
  debtNumber?: string;
  direction: "receivable" | "payable";
  partyName: string;
  partyPhone?: string;
  sourceType?: string;
  sourceId?: number;
  saleNumber?: string;
  purchaseNumber?: string;
  totalAmount: number;
  amountPaid: number;
  outstandingAmount: number;
  status: string;
  dueDate?: string;
  createdAt?: string;
  branchId?: number;
}

export interface DashboardLowStockRow {
  itemId: number;
  itemCode: string;
  itemName: string;
  categoryName: string;
  branchId?: number;
  branchName?: string;
  currentQuantityGrams: number;
  minStockLevelGrams: number;
  availableQuantityGrams: number;
}

export interface SalesChartPoint {
  dayKey: string;
  dayLabel: string;
  revenue: number;
  profit: number;
  orders: number;
}
