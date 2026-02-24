import { useCallback, useMemo } from "react";
import {
  AlertTriangle,
  CreditCard,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FiltersBar } from "@/components/dashboard/FiltersBar";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { DebtsTable } from "@/components/dashboard/DebtsTable";
import { LowStockTable } from "@/components/dashboard/LowStockTable";
import {
  buildDashboardSearchParams,
  buildSalesChartData,
  getDefaultDashboardFilters,
  getDelta,
  getPreviousDateRange,
  getRangeLabel,
  isDateInsideRange,
  mapDebtRow,
  mapLowStockRow,
  normalizeDashboardFilters,
  parseDashboardFilters,
} from "@/components/dashboard/dashboard-utils";
import type { DashboardDebtRow, DashboardKpiItem, DashboardLowStockRow } from "@/components/dashboard/types";
import { usePayables, useReceivables } from "@/hooks/use-debts";
import { useBranches } from "@/hooks/use-branches";
import { useLowStockItems } from "@/hooks/use-inventory";
import { useSalesReport } from "@/hooks/use-reports";
import { useRole } from "@/hooks/useRole";
import { formatCurrency } from "@/lib/formatters";

function sumOutstanding(rows: DashboardDebtRow[]): number {
  return rows.reduce((sum, row) => sum + row.outstandingAmount, 0);
}

function formatSignedAmount(value: number): string {
  const absolute = formatCurrency(Math.abs(value));
  if (value > 0) return `+ ${absolute}`;
  if (value < 0) return `- ${absolute}`;
  return absolute;
}

function applyBranchFilter<T extends { branchId?: number }>(rows: T[], branchId?: number): T[] {
  if (!branchId) return rows;
  return rows.filter((row) => row.branchId === branchId);
}

function applySearchToDebts(rows: DashboardDebtRow[], search: string): DashboardDebtRow[] {
  const term = search.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) =>
    [row.partyName, row.partyPhone, row.debtNumber, row.saleNumber, row.purchaseNumber]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term)),
  );
}

function applySearchToLowStock(rows: DashboardLowStockRow[], search: string): DashboardLowStockRow[] {
  const term = search.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) =>
    [row.itemName, row.itemCode, row.categoryName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term)),
  );
}

function filterDebtsByRange(rows: DashboardDebtRow[], startDate: string, endDate: string): DashboardDebtRow[] {
  return rows.filter((row) => {
    if (!row.createdAt) return true;
    return isDateInsideRange(row.createdAt, { startDate, endDate });
  });
}

export default function DashboardPage() {
  const { isAdmin } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseDashboardFilters(searchParams), [searchParams]);
  const activeRange = useMemo(
    () => ({ startDate: filters.startDate, endDate: filters.endDate }),
    [filters.endDate, filters.startDate],
  );
  const previousRange = useMemo(() => getPreviousDateRange(activeRange), [activeRange]);

  const branchesQuery = useBranches();
  const salesCurrentQuery = useSalesReport(activeRange);
  const salesPreviousQuery = useSalesReport(previousRange);
  const receivablesQuery = useReceivables({ page: 1, pageSize: 500 });
  const payablesQuery = usePayables({ page: 1, pageSize: 500 });
  const lowStockQuery = useLowStockItems();

  const updateFilters = useCallback(
    (patch: Partial<typeof filters>) => {
      const merged = normalizeDashboardFilters({ ...filters, ...patch });
      setSearchParams(buildDashboardSearchParams(merged), { replace: true });
    },
    [filters, setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(buildDashboardSearchParams(getDefaultDashboardFilters()), { replace: true });
  }, [setSearchParams]);

  const retryAll = useCallback(() => {
    void Promise.all([
      salesCurrentQuery.refetch(),
      salesPreviousQuery.refetch(),
      receivablesQuery.refetch(),
      payablesQuery.refetch(),
      lowStockQuery.refetch(),
    ]);
  }, [lowStockQuery, payablesQuery, receivablesQuery, salesCurrentQuery, salesPreviousQuery]);

  const receivableRows = useMemo(() => {
    const source = (receivablesQuery.data?.data ?? []) as unknown[];
    return source.map(mapDebtRow).filter((row): row is DashboardDebtRow => !!row);
  }, [receivablesQuery.data?.data]);

  const payableRows = useMemo(() => {
    const source = (payablesQuery.data?.data ?? []) as unknown[];
    return source.map(mapDebtRow).filter((row): row is DashboardDebtRow => !!row);
  }, [payablesQuery.data?.data]);

  const lowStockRows = useMemo(() => {
    const source = (lowStockQuery.data ?? []) as unknown[];
    return source.map(mapLowStockRow).filter((row): row is DashboardLowStockRow => !!row);
  }, [lowStockQuery.data]);

  const branchReceivables = useMemo(
    () => applyBranchFilter(receivableRows, filters.branchId),
    [filters.branchId, receivableRows],
  );
  const branchPayables = useMemo(
    () => applyBranchFilter(payableRows, filters.branchId),
    [filters.branchId, payableRows],
  );
  const branchLowStock = useMemo(
    () => applyBranchFilter(lowStockRows, filters.branchId),
    [filters.branchId, lowStockRows],
  );

  const currentReceivables = useMemo(
    () => filterDebtsByRange(branchReceivables, activeRange.startDate, activeRange.endDate),
    [activeRange.endDate, activeRange.startDate, branchReceivables],
  );
  const previousReceivables = useMemo(
    () => filterDebtsByRange(branchReceivables, previousRange.startDate, previousRange.endDate),
    [branchReceivables, previousRange.endDate, previousRange.startDate],
  );

  const currentPayables = useMemo(
    () => filterDebtsByRange(branchPayables, activeRange.startDate, activeRange.endDate),
    [activeRange.endDate, activeRange.startDate, branchPayables],
  );
  const previousPayables = useMemo(
    () => filterDebtsByRange(branchPayables, previousRange.startDate, previousRange.endDate),
    [branchPayables, previousRange.endDate, previousRange.startDate],
  );

  const tableDebtsRows = useMemo(
    () => applySearchToDebts(currentReceivables, filters.search),
    [currentReceivables, filters.search],
  );
  const tableLowStockRows = useMemo(
    () => applySearchToLowStock(branchLowStock, filters.search),
    [branchLowStock, filters.search],
  );

  const currentSummary = salesCurrentQuery.data?.summary;
  const previousSummary = salesPreviousQuery.data?.summary;
  const salesCount = currentSummary?.count ?? 0;
  const salesRevenue = currentSummary?.netRevenue ?? 0;
  const salesProfit = currentSummary?.profit ?? 0;
  const previousSalesCount = previousSummary?.count ?? 0;
  const previousSalesRevenue = previousSummary?.netRevenue ?? 0;
  const previousSalesProfit = previousSummary?.profit ?? 0;

  const receivablesAmount = sumOutstanding(currentReceivables);
  const payablesAmount = sumOutstanding(currentPayables);
  const previousReceivablesAmount = sumOutstanding(previousReceivables);
  const previousPayablesAmount = sumOutstanding(previousPayables);
  const lowStockCount = branchLowStock.length;

  const salesCountDelta = getDelta(salesCount, previousSalesCount);
  const salesRevenueDelta = getDelta(salesRevenue, previousSalesRevenue);
  const salesProfitDelta = getDelta(salesProfit, previousSalesProfit);
  const receivablesDelta = getDelta(receivablesAmount, previousReceivablesAmount);
  const payablesDelta = getDelta(payablesAmount, previousPayablesAmount);
  const lowStockDelta = getDelta(lowStockCount, lowStockCount);

  const kpiItems: DashboardKpiItem[] = [
    {
      key: "sales-count",
      title: "عدد المبيعات",
      value: salesCount.toLocaleString("ar-SA"),
      rawValue: salesCount,
      icon: ShoppingCart,
      tone: "default",
      deltaPct: salesCountDelta.pct,
      deltaDirection: salesCountDelta.direction,
      subtitle: "مقارنة بالفترة السابقة",
      details: [
        { label: "الفترة الحالية", value: salesCount.toLocaleString("ar-SA") },
        { label: "الفترة السابقة", value: previousSalesCount.toLocaleString("ar-SA") },
        { label: "الفرق", value: formatSignedAmount(salesCount - previousSalesCount) },
      ],
      actionLabel: "عرض المبيعات",
      actionTo: "/sales",
    },
    {
      key: "sales-revenue",
      title: "إجمالي الإيرادات",
      value: formatCurrency(salesRevenue),
      rawValue: salesRevenue,
      icon: DollarSign,
      tone: "success",
      deltaPct: salesRevenueDelta.pct,
      deltaDirection: salesRevenueDelta.direction,
      subtitle: "صافي الإيراد للفترة",
      details: [
        { label: "إيراد الفترة الحالية", value: formatCurrency(salesRevenue) },
        { label: "إيراد الفترة السابقة", value: formatCurrency(previousSalesRevenue) },
        { label: "الفرق", value: formatSignedAmount(salesRevenue - previousSalesRevenue) },
      ],
      actionLabel: "فتح تقارير المبيعات",
      actionTo: "/reports/sales",
    },
    {
      key: "low-stock",
      title: "قطع منخفضة المخزون",
      value: lowStockCount.toLocaleString("ar-SA"),
      rawValue: lowStockCount,
      icon: AlertTriangle,
      tone: "warning",
      deltaPct: lowStockDelta.pct,
      deltaDirection: lowStockDelta.direction,
      subtitle: "لقطة حالية حسب الفلاتر",
      details: [
        { label: "عدد الأصناف المنخفضة", value: lowStockCount.toLocaleString("ar-SA") },
        { label: "فلتر الفرع", value: filters.branchId ? `#${filters.branchId}` : "كل الفروع" },
        { label: "ملاحظة", value: "هذا المؤشر لقطة لحظية من المخزون الحالي" },
      ],
      actionLabel: "فتح المخزون",
      actionTo: "/inventory",
    },
    {
      key: "customer-debts",
      title: "ديون الزبائن",
      value: formatCurrency(receivablesAmount),
      rawValue: receivablesAmount,
      icon: CreditCard,
      tone: "danger",
      deltaPct: receivablesDelta.pct,
      deltaDirection: receivablesDelta.direction,
      subtitle: "مستحقات غير محصلة",
      size: "wide",
      details: [
        { label: "الرصيد الحالي", value: formatCurrency(receivablesAmount) },
        { label: "الرصيد السابق", value: formatCurrency(previousReceivablesAmount) },
        { label: "عدد السجلات", value: currentReceivables.length.toLocaleString("ar-SA") },
      ],
      actionLabel: "إدارة ديون الزبائن",
      actionTo: "/debts",
    },
    {
      key: "supplier-debts",
      title: "ديون الموردين",
      value: formatCurrency(payablesAmount),
      rawValue: payablesAmount,
      icon: Wallet,
      tone: "warning",
      deltaPct: payablesDelta.pct,
      deltaDirection: payablesDelta.direction,
      subtitle: "التزامات مالية مستحقة",
      size: "wide",
      details: [
        { label: "الرصيد الحالي", value: formatCurrency(payablesAmount) },
        { label: "الرصيد السابق", value: formatCurrency(previousPayablesAmount) },
        { label: "عدد السجلات", value: currentPayables.length.toLocaleString("ar-SA") },
      ],
      actionLabel: "إدارة ديون الموردين",
      actionTo: "/debts",
    },
  ];

  if (isAdmin) {
    kpiItems.splice(2, 0, {
      key: "sales-profit",
      title: "إجمالي الأرباح",
      value: formatCurrency(salesProfit),
      rawValue: salesProfit,
      icon: TrendingUp,
      tone: "info",
      deltaPct: salesProfitDelta.pct,
      deltaDirection: salesProfitDelta.direction,
      subtitle: "إجمالي الربح للفترة",
      details: [
        { label: "ربح الفترة الحالية", value: formatCurrency(salesProfit) },
        { label: "ربح الفترة السابقة", value: formatCurrency(previousSalesProfit) },
        { label: "الفرق", value: formatSignedAmount(salesProfit - previousSalesProfit) },
      ],
      actionLabel: "تحليل الربحية",
      actionTo: "/reports/profit-loss",
    });
  }

  const chartData = useMemo(
    () => buildSalesChartData(salesCurrentQuery.data?.sales),
    [salesCurrentQuery.data?.sales],
  );

  const kpiLoading =
    salesCurrentQuery.isLoading ||
    salesPreviousQuery.isLoading ||
    receivablesQuery.isLoading ||
    payablesQuery.isLoading ||
    lowStockQuery.isLoading;
  const kpiError =
    salesCurrentQuery.isError ||
    salesPreviousQuery.isError ||
    receivablesQuery.isError ||
    payablesQuery.isError ||
    lowStockQuery.isError;

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="mt-1 text-muted-foreground">متابعة الأداء المالي والتشغيلي بشكل تفاعلي</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild className="gap-2">
            <Link to="/sales/new">
              <ShoppingCart className="h-4 w-4" />
              بيع جديد
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/reports/sales">تقارير المبيعات</Link>
          </Button>
          {!isAdmin && (
            <span className="text-xs text-muted-foreground">عرض الأرباح متاح حسب صلاحيات الدور</span>
          )}
        </div>
      </header>

      <FiltersBar
        filters={filters}
        branches={branchesQuery.data ?? []}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      <KpiGrid items={kpiItems} isLoading={kpiLoading} isError={kpiError} onRetry={retryAll} />

      <ChartCard
        data={chartData}
        rangeLabel={getRangeLabel(activeRange)}
        isLoading={salesCurrentQuery.isLoading}
        isError={salesCurrentQuery.isError}
        onRetry={() => {
          void salesCurrentQuery.refetch();
        }}
      />

      <div className="grid gap-6 2xl:grid-cols-2">
        <DebtsTable
          rows={tableDebtsRows}
          range={activeRange}
          isLoading={receivablesQuery.isLoading}
          isError={receivablesQuery.isError}
          onRetry={() => {
            void receivablesQuery.refetch();
          }}
        />
        <LowStockTable
          rows={tableLowStockRows}
          isLoading={lowStockQuery.isLoading}
          isError={lowStockQuery.isError}
          onRetry={() => {
            void lowStockQuery.refetch();
          }}
        />
      </div>
    </div>
  );
}
