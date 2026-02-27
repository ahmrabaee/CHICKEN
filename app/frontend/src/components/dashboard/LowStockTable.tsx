import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpDown,
  Eye,
  MoreHorizontal,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StockStatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { gramsToKg } from "@/components/dashboard/dashboard-utils";
import type { DashboardLowStockRow } from "@/components/dashboard/types";
import { cn } from "@/lib/utils";

type StockSortKey = "itemName" | "categoryName" | "currentQuantityGrams" | "minStockLevelGrams" | "gapGrams";

interface LowStockTableProps {
  rows: DashboardLowStockRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function LowStockTable({ rows, isLoading, isError, onRetry }: LowStockTableProps) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<StockSortKey>("gapGrams");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  useEffect(() => {
    setPage(1);
  }, [rows.length, pageSize]);

  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const aGap = Math.max(0, a.minStockLevelGrams - a.availableQuantityGrams);
      const bGap = Math.max(0, b.minStockLevelGrams - b.availableQuantityGrams);
      let compared = 0;
      if (sortBy === "itemName") compared = a.itemName.localeCompare(b.itemName, "ar");
      else if (sortBy === "categoryName") compared = a.categoryName.localeCompare(b.categoryName, "ar");
      else if (sortBy === "currentQuantityGrams") compared = a.availableQuantityGrams - b.availableQuantityGrams;
      else if (sortBy === "minStockLevelGrams") compared = a.minStockLevelGrams - b.minStockLevelGrams;
      else compared = aGap - bGap;
      return sortDirection === "asc" ? compared : -compared;
    });
    return list;
  }, [rows, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: StockSortKey) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    setSortDirection(key === "itemName" || key === "categoryName" ? "asc" : "desc");
  };



  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="space-y-1">
          <CardTitle className="text-lg">قطع قريبة من النفاذ</CardTitle>
          <p className="text-xs text-muted-foreground">{rows.length} صنف منخفض المخزون</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={`low-stock-row-skeleton-${idx}`} className="h-11 w-full" />
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-6 w-6 text-rose-600" />
            <p className="text-sm text-rose-700">تعذر تحميل بيانات المخزون المنخفض.</p>
            <Button variant="outline" className="gap-2" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              إعادة المحاولة
            </Button>
          </div>
        )}

        {!isLoading && !isError && sortedRows.length === 0 && (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">ممتاز. لا توجد أصناف قريبة من النفاذ حالياً.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link to="/inventory">فتح صفحة المخزون</Link>
              </Button>
              <Button asChild>
                <Link to="/inventory/new">إضافة صنف جديد</Link>
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !isError && sortedRows.length > 0 && (
          <>
            <div className="max-h-[420px] overflow-auto rounded-md border">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 z-10 bg-muted/90 text-right backdrop-blur">
                      <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => toggleSort("itemName")}>
                        الصنف
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-muted/90 text-right backdrop-blur">
                      <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => toggleSort("categoryName")}>
                        الفئة
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-muted/90 text-right backdrop-blur">
                      <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => toggleSort("currentQuantityGrams")}>
                        المتوفر
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-muted/90 text-right backdrop-blur">
                      <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => toggleSort("minStockLevelGrams")}>
                        الحد الأدنى
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-muted/90 text-right backdrop-blur">
                      <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => toggleSort("gapGrams")}>
                        العجز
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="sticky top-0 z-10 bg-muted/90 text-right backdrop-blur">الحالة</TableHead>
                    <TableHead className="sticky top-0 z-10 bg-muted/90 text-center backdrop-blur">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row) => {
                    const gap = Math.max(0, row.minStockLevelGrams - row.availableQuantityGrams);
                    return (
                      <TableRow key={row.itemId} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{row.itemName}</span>
                            <span className="text-xs text-muted-foreground">{row.itemCode}</span>
                          </div>
                        </TableCell>
                        <TableCell>{row.categoryName}</TableCell>
                        <TableCell>{gramsToKg(row.availableQuantityGrams)}</TableCell>
                        <TableCell>{gramsToKg(row.minStockLevelGrams)}</TableCell>
                        <TableCell className={cn("font-semibold", gap > 0 ? "text-rose-700" : "text-emerald-700")}>
                          {gramsToKg(gap)}
                        </TableCell>
                        <TableCell>
                          <StockStatusBadge current={row.availableQuantityGrams} min={row.minStockLevelGrams} />
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">فتح إجراءات الصنف</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" dir="rtl">
                              <DropdownMenuItem onClick={() => navigate(`/inventory/${row.itemId}`)} className="gap-2">
                                <Eye className="h-4 w-4 text-slate-500" />
                                عرض الصنف
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/purchasing/new?itemId=${row.itemId}`)} className="gap-2">
                                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                                إعادة الطلب
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>عدد الصفوف:</span>
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                  <SelectTrigger className="h-8 w-[84px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="12">12</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={safePage <= 1}>
                  السابق
                </Button>
                <span className="text-sm text-muted-foreground">
                  صفحة {safePage} من {totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={safePage >= totalPages}>
                  التالي
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
