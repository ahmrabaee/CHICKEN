import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpDown,
  CreditCard,
  Eye,
  MoreHorizontal,
  Pencil,
  RefreshCw,
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
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRangeLabel } from "@/components/dashboard/dashboard-utils";
import type { DashboardDateRange, DashboardDebtRow } from "@/components/dashboard/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type DebtSortKey = "partyName" | "outstandingAmount" | "dueDate" | "status";

interface DebtsTableProps {
  rows: DashboardDebtRow[];
  range: DashboardDateRange;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function getStatusMeta(status: string): { tone: "success" | "warning" | "danger" | "default"; label: string } {
  if (status === "paid" || status === "settled") return { tone: "success", label: "مسدد" };
  if (status === "partial") return { tone: "warning", label: "جزئي" };
  if (status === "overdue") return { tone: "danger", label: "متأخر" };
  if (status === "written_off") return { tone: "default", label: "مشطوب" };
  return { tone: "danger", label: "قائم" };
}

function getPayLink(row: DashboardDebtRow): string {
  if (row.sourceType === "sale" && row.sourceId) {
    return `/payments/new?saleId=${row.sourceId}`;
  }
  if (row.sourceType === "purchase" && row.sourceId) {
    return `/payments/new?purchaseId=${row.sourceId}`;
  }
  return "/payments/new";
}

function formatSafeDate(value?: string): string {
  if (!value) return "—";
  try {
    return formatDate(value);
  } catch {
    return "—";
  }
}

export function DebtsTable({ rows, range, isLoading, isError, onRetry }: DebtsTableProps) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<DebtSortKey>("outstandingAmount");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [activeRow, setActiveRow] = useState<DashboardDebtRow | null>(null);

  useEffect(() => {
    setPage(1);
  }, [rows.length, pageSize]);

  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      let compared = 0;
      if (sortBy === "partyName") {
        compared = a.partyName.localeCompare(b.partyName, "ar");
      } else if (sortBy === "outstandingAmount") {
        compared = a.outstandingAmount - b.outstandingAmount;
      } else if (sortBy === "status") {
        compared = a.status.localeCompare(b.status, "ar");
      } else {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
        compared = aDate - bDate;
      }
      return sortDirection === "asc" ? compared : -compared;
    });
    return list;
  }, [rows, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: DebtSortKey) => {
    if (key === sortBy) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    setSortDirection("desc");
  };



  return (
    <>
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">ديون الزبائن</CardTitle>
            <p className="text-xs text-muted-foreground">
              {getRangeLabel(range)} • {rows.length} سجل
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={`debts-row-skeleton-${idx}`} className="h-11 w-full" />
              ))}
            </div>
          )}

          {!isLoading && isError && (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
              <AlertCircle className="h-6 w-6 text-rose-600" />
              <p className="text-sm text-rose-700">تعذر تحميل بيانات ديون الزبائن.</p>
              <Button variant="outline" className="gap-2" onClick={onRetry}>
                <RefreshCw className="h-4 w-4" />
                إعادة المحاولة
              </Button>
            </div>
          )}

          {!isLoading && !isError && sortedRows.length === 0 && (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-center">
              <p className="text-sm text-muted-foreground">لا توجد ديون زبائن مطابقة للفلاتر الحالية.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline">
                  <Link to="/debts">إدارة الديون</Link>
                </Button>
                <Button asChild>
                  <Link to="/payments/new">تسجيل دفعة</Link>
                </Button>
              </div>
            </div>
          )}

          {!isLoading && !isError && sortedRows.length > 0 && (
            <>
              <div className="max-h-[420px] overflow-auto rounded-md border">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 z-10 bg-muted/90 text-right backdrop-blur">
                        <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => toggleSort("partyName")}>
                          الزبون
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 bg-muted/90 text-right backdrop-blur">الهاتف</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-muted/90 text-right backdrop-blur">
                        <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => toggleSort("outstandingAmount")}>
                          المبلغ المتبقي
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 bg-muted/90 text-right backdrop-blur">
                        <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => toggleSort("dueDate")}>
                          تاريخ الاستحقاق
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 bg-muted/90 text-right backdrop-blur">
                        <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => toggleSort("status")}>
                          الحالة
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                      <TableHead className="sticky top-0 z-10 bg-muted/90 text-center backdrop-blur">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((row) => {
                      const status = getStatusMeta(row.status);
                      return (
                        <TableRow key={row.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{row.partyName}</TableCell>
                          <TableCell className="text-muted-foreground" dir="ltr">
                            {row.partyPhone || "—"}
                          </TableCell>
                          <TableCell className="font-semibold text-rose-700">
                            {formatCurrency(row.outstandingAmount)}
                          </TableCell>
                          <TableCell>{formatSafeDate(row.dueDate)}</TableCell>
                          <TableCell>
                            <StatusBadge status={status.tone}>{status.label}</StatusBadge>
                          </TableCell>
                          <TableCell className="text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">فتح قائمة إجراءات الدين</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" dir="rtl">
                                <DropdownMenuItem onClick={() => setActiveRow(row)} className="gap-2">
                                  <Eye className="h-4 w-4 text-slate-500" />
                                  عرض
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(getPayLink(row))} className="gap-2">
                                  <CreditCard className="h-4 w-4 text-emerald-600" />
                                  تحصيل / دفع
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate("/debts")} className="gap-2">
                                  <Pencil className="h-4 w-4 text-blue-600" />
                                  تعديل
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

      <Sheet open={!!activeRow} onOpenChange={(open) => !open && setActiveRow(null)}>
        <SheetContent side="left" className="w-full max-w-md overflow-y-auto" dir="rtl">
          {activeRow && (
            <>
              <SheetHeader className="text-right">
                <SheetTitle>تفاصيل دين الزبون</SheetTitle>
                <SheetDescription>{activeRow.partyName}</SheetDescription>
              </SheetHeader>
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">المبلغ المتبقي</p>
                  <p className="mt-1 text-2xl font-black text-rose-700">{formatCurrency(activeRow.outstandingAmount)}</p>
                </div>
                <div className="space-y-3 rounded-lg border p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">المرجع</span>
                    <span className="font-medium">{activeRow.saleNumber ?? activeRow.purchaseNumber ?? activeRow.debtNumber ?? `#${activeRow.id}`}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">الإجمالي</span>
                    <span className="font-medium">{formatCurrency(activeRow.totalAmount)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">المدفوع</span>
                    <span className="font-medium">{formatCurrency(activeRow.amountPaid)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">تاريخ الاستحقاق</span>
                    <span className={cn("font-medium", !activeRow.dueDate && "text-muted-foreground")}>
                      {formatSafeDate(activeRow.dueDate)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button onClick={() => navigate(getPayLink(activeRow))}>تحصيل / دفع</Button>
                  <Button variant="outline" onClick={() => navigate("/debts")}>
                    فتح سجل الديون
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
