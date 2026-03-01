import { useMemo, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Package,
  PieChart,
  Receipt,
  Download,
  Calendar,
  Loader2,
  Trash2,
  Wallet,
  DollarSign,
  Scale,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  useSalesReport,
  usePurchasesReport,
  useInventoryReport,
  useExpenseReport,
  useProfitLossReport,
  useWastageReport,
  useStockVsGLReport,
} from "@/hooks/use-reports";
import { useVATReport } from "@/hooks/use-tax";
import type { DateRangeQuery } from "@/types/reports";
import { PdfPreviewDialog } from "@/components/reports/PdfPreviewDialog";
import { DatePicker } from "@/components/ui/date-picker";
import { useRole } from "@/hooks/useRole";

function formatMinor(amount: number): string {
  return (amount / 100).toFixed(2);
}

const wastageReasonLabels: Record<string, string> = {
  expired: "منتهي الصلاحية",
  damaged: "تالف",
  spoiled: "فاسد",
  processing_loss: "فقد تصنيع",
  other: "أخرى",
};

function getDefaultDateRange(): DateRangeQuery {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

const REPORT_PDF_MAP: Record<
  string,
  { type: string; title: string; getParams: (range: DateRangeQuery, stockDate?: string) => object }
> = {
  "/reports/sales": {
    type: "sales-report",
    title: "تصدير تقرير المبيعات PDF",
    getParams: (r) => ({ startDate: r.startDate, endDate: r.endDate }),
  },
  "/reports/purchases": {
    type: "purchases-report",
    title: "تصدير تقرير المشتريات PDF",
    getParams: (r) => ({ startDate: r.startDate, endDate: r.endDate }),
  },
  "/reports/inventory": {
    type: "inventory-report",
    title: "تصدير تقرير المخزون PDF",
    getParams: () => ({}),
  },
  "/reports/expenses": {
    type: "expenses-report",
    title: "تصدير تقرير المصروفات PDF",
    getParams: (r) => ({ startDate: r.startDate, endDate: r.endDate }),
  },
  "/reports/profit-loss": {
    type: "income-statement",
    title: "تصدير قائمة الدخل PDF",
    getParams: (r) => ({ startDate: r.startDate, endDate: r.endDate }),
  },
};

const ALL_REPORT_LINKS = [
  { href: "/reports/sales", label: "المبيعات", icon: TrendingUp, description: "تحليل أداء المبيعات والأرباح" },
  { href: "/reports/purchases", label: "المشتريات", icon: Receipt, description: "سجل المشتريات حسب الفترة" },
  { href: "/reports/inventory", label: "المخزون", icon: Package, description: "تقييم المخزون وحركة البضاعة" },
  { href: "/reports/expenses", label: "المصروفات", icon: Wallet, adminOnly: true, description: "ملخص المصروفات حسب النوع" },
  { href: "/reports/profit-loss", label: "الأرباح والخسائر", icon: PieChart, adminOnly: true, description: "قائمة الدخل للفترة" },
  { href: "/reports/wastage", label: "الهدر", icon: Trash2, description: "سجل الهدر والتلف" },
  { href: "/reports/stock-vs-gl", label: "المخزون vs الدفاتر", icon: Scale, adminOnly: true, description: "مقارنة قيمة المخزون مع قيود اليومية" },
  { href: "/reports/vat", label: "ضريبة القيمة المضافة", icon: Receipt, adminOnly: true, description: "Output VAT، Input VAT، صافي المستحق" },
];


export default function Reports() {
  const { canAccessPath } = useRole();
  const location = useLocation();
  const navigate = useNavigate();
  const reportLinks = ALL_REPORT_LINKS.filter((l) => canAccessPath(l.href));
  const currentPath = location.pathname;
  const isSubPage = currentPath !== "/reports";
  const [dateRange, setDateRange] = useState<DateRangeQuery>(getDefaultDateRange());
  const [rangePreset, setRangePreset] = useState("month");
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);

  const rangeForQuery = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;
    switch (rangePreset) {
      case "today":
        start = new Date(now);
        end = new Date(now);
        break;
      case "week":
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        end = new Date(now);
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "quarter":
        start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        return dateRange;
    }
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }, [rangePreset, dateRange]);

  const needsDateRange =
    currentPath.includes("sales") ||
    currentPath.includes("purchases") ||
    currentPath.includes("expenses") ||
    currentPath.includes("profit-loss") ||
    currentPath.includes("wastage") ||
    currentPath.includes("vat");

  const salesParams = currentPath === "/reports/sales" ? rangeForQuery : { startDate: "", endDate: "" };
  const purchasesParams = currentPath === "/reports/purchases" ? rangeForQuery : { startDate: "", endDate: "" };
  const expenseParams = currentPath === "/reports/expenses" ? rangeForQuery : { startDate: "", endDate: "" };
  const profitLossParams = currentPath === "/reports/profit-loss" ? rangeForQuery : { startDate: "", endDate: "" };
  const wastageParams = currentPath === "/reports/wastage" ? rangeForQuery : { startDate: "", endDate: "" };
  const [stockVsGLDate, setStockVsGLDate] = useState(new Date().toISOString().slice(0, 10));
  const stockVsGLParams = currentPath === "/reports/stock-vs-gl" ? { asOfDate: stockVsGLDate } : undefined;
  const vatParams = currentPath === "/reports/vat" ? rangeForQuery : { startDate: "", endDate: "" };

  const { data: salesReport, isLoading: salesLoading } = useSalesReport(salesParams);
  const { data: purchasesReport, isLoading: purchasesLoading } = usePurchasesReport(purchasesParams);
  const { data: inventoryReport, isLoading: inventoryLoading } = useInventoryReport();
  const { data: expenseReport, isLoading: expenseLoading } = useExpenseReport(expenseParams);
  const { data: profitLossReport, isLoading: profitLossLoading } = useProfitLossReport(profitLossParams);
  const { data: wastageReport, isLoading: wastageLoading } = useWastageReport(wastageParams);
  const { data: stockVsGLReport, isLoading: stockVsGLLoading } = useStockVsGLReport(stockVsGLParams);
  const { data: vatReport, isLoading: vatLoading } = useVATReport(
    vatParams.startDate,
    vatParams.endDate
  );

  const isLoading =
    (currentPath === "/reports/sales" && salesLoading) ||
    (currentPath === "/reports/purchases" && purchasesLoading) ||
    (currentPath === "/reports/inventory" && inventoryLoading) ||
    (currentPath === "/reports/expenses" && expenseLoading) ||
    (currentPath === "/reports/profit-loss" && profitLossLoading) ||
    (currentPath === "/reports/wastage" && wastageLoading) ||
    (currentPath === "/reports/stock-vs-gl" && stockVsGLLoading) ||
    (currentPath === "/reports/vat" && vatLoading);

  const content = useMemo(() => {
    switch (currentPath) {
      case "/reports/sales":
        return { title: "تقارير المبيعات", description: "تحليل أداء المبيعات والأرباح", icon: TrendingUp };
      case "/reports/purchases":
        return { title: "تقارير المشتريات", description: "سجل المشتريات حسب الفترة", icon: Receipt };
      case "/reports/inventory":
        return { title: "تقارير المخزون", description: "تقييم المخزون وحركة البضاعة", icon: Package };
      case "/reports/expenses":
        return { title: "تقارير المصروفات", description: "ملخص المصروفات حسب النوع", icon: Wallet };
      case "/reports/profit-loss":
        return { title: "الأرباح والخسائر", description: "قائمة الدخل للفترة", icon: PieChart };
      case "/reports/wastage":
        return { title: "تقارير الهدر", description: "سجل الهدر والتلف", icon: Trash2 };
      case "/reports/stock-vs-gl":
        return { title: "المخزون مقابل الدفاتر", description: "مقارنة قيمة المخزون مع قيود اليومية", icon: Scale };
      case "/reports/vat":
        return { title: "تقرير ضريبة القيمة المضافة", description: "Output VAT، Input VAT، صافي المستحق", icon: Receipt };
      default:
        return { title: "التقارير", description: "اختيار نوع التقرير واستعراض البيانات التحليلية.", icon: BarChart3 };
    }
  }, [currentPath]);

  const Icon = content.icon;
  const pdfConfig = REPORT_PDF_MAP[currentPath];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {isSubPage && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(-1)}
              className="shrink-0"
              title="الرجوع"
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{content.title}</h1>
            <p className="text-muted-foreground mt-1">{content.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {currentPath === "/reports/stock-vs-gl" && (
            <DatePicker
              value={stockVsGLDate}
              onChange={setStockVsGLDate}
              placeholder="تاريخ الجرد"
            />
          )}
          {needsDateRange && (
            <Select value={rangePreset} onValueChange={setRangePreset}>
              <SelectTrigger className="w-40 gap-2">
                <Calendar className="w-4 h-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="week">هذا الأسبوع</SelectItem>
                <SelectItem value="month">هذا الشهر</SelectItem>
                <SelectItem value="quarter">هذا الربع</SelectItem>
                <SelectItem value="year">هذه السنة</SelectItem>
              </SelectContent>
            </Select>
          )}
          {pdfConfig && (
            <Button
              variant="outline"
              className="gap-2 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-200"
              onClick={() => setPdfDialogOpen(true)}
            >
              <Download className="w-4 h-4" />
              تصدير PDF
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Sales */}
          {currentPath === "/reports/sales" && salesReport && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    ملخص المبيعات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><span className="text-muted-foreground">عدد الفواتير:</span> <strong>{salesReport.summary.count}</strong></p>
                  <p><span className="text-muted-foreground">صافي الإيرادات:</span> <strong>₪ {formatMinor(salesReport.summary.netRevenue)}</strong></p>
                  <p><span className="text-muted-foreground">التكلفة:</span> <strong>₪ {formatMinor(salesReport.summary.cost)}</strong></p>
                  <p><span className="text-muted-foreground">الربح:</span> <strong className="text-green-600">₪ {formatMinor(salesReport.summary.profit)}</strong></p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>إجماليات</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-success">₪ {formatMinor(salesReport.summary.netRevenue)}</p>
                  <p className="text-sm text-muted-foreground">صافي الإيرادات للفترة</p>
                </CardContent>
              </Card>
            </div>
          )}
          {currentPath === "/reports/sales" && salesReport && salesReport.sales?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل المبيعات</CardTitle>
                <CardDescription>الفواتير ضمن الفترة المحددة</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="data-table-header">
                      <TableHead className="text-right">رقم الفاتورة</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الزبون</TableHead>
                      <TableHead className="text-center">المبلغ</TableHead>
                      <TableHead className="text-center">الربح</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesReport.sales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono">{s.saleNumber}</TableCell>
                        <TableCell>{typeof s.date === "string" ? s.date.slice(0, 10) : ""}</TableCell>
                        <TableCell>{s.customerName ?? "—"}</TableCell>
                        <TableCell className="text-center">₪ {formatMinor(s.total)}</TableCell>
                        <TableCell className="text-center text-green-600">₪ {formatMinor(s.profit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Purchases */}
          {currentPath === "/reports/purchases" && purchasesReport && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    ملخص المشتريات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><span className="text-muted-foreground">عدد أوامر الشراء:</span> <strong>{purchasesReport.summary.count}</strong></p>
                  <p><span className="text-muted-foreground">إجمالي المشتريات:</span> <strong>₪ {formatMinor(purchasesReport.summary.totalAmount)}</strong></p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>الإجمالي</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">₪ {formatMinor(purchasesReport.summary.totalAmount)}</p>
                </CardContent>
              </Card>
            </div>
          )}
          {currentPath === "/reports/purchases" && purchasesReport && purchasesReport.purchases?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل المشتريات</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="data-table-header">
                      <TableHead className="text-right">رقم الأمر</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">التاجر</TableHead>
                      <TableHead className="text-center">المبلغ</TableHead>
                      <TableHead className="text-center">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchasesReport.purchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono">{p.purchaseNumber}</TableCell>
                        <TableCell>{typeof p.date === "string" ? p.date.slice(0, 10) : ""}</TableCell>
                        <TableCell>{p.supplierName}</TableCell>
                        <TableCell className="text-center">₪ {formatMinor(p.total)}</TableCell>
                        <TableCell className="text-center">{p.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Inventory */}
          {currentPath === "/reports/inventory" && inventoryReport && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    ملخص المخزون
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><span className="text-muted-foreground">عدد الأصناف:</span> <strong>{inventoryReport.summary.totalItems}</strong></p>
                  <p><span className="text-muted-foreground">الكمية الإجمالية (غ):</span> <strong>{inventoryReport.summary.totalWeight}</strong></p>
                  <p><span className="text-muted-foreground">قيمة المخزون:</span> <strong>₪ {formatMinor(inventoryReport.summary.totalValue)}</strong></p>
                  <p><span className="text-muted-foreground">الدفعات النشطة:</span> <strong>{inventoryReport.summary.activeLots}</strong></p>
                </CardContent>
              </Card>
            </div>
          )}
          {currentPath === "/reports/inventory" && inventoryReport && inventoryReport.items?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل الأصناف</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="data-table-header">
                      <TableHead className="text-right">الصنف</TableHead>
                      <TableHead className="text-right">الفئة</TableHead>
                      <TableHead className="text-center">الكمية (غ)</TableHead>
                      <TableHead className="text-center">القيمة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryReport.items.map((inv) => (
                      <TableRow key={inv.itemId}>
                        <TableCell className="font-medium">{inv.itemName}</TableCell>
                        <TableCell>{inv.categoryName ?? "—"}</TableCell>
                        <TableCell className="text-center font-english" dir="ltr">{inv.currentWeight}</TableCell>
                        <TableCell className="text-center">₪ {formatMinor(inv.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Expenses */}
          {currentPath === "/reports/expenses" && expenseReport && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    ملخص المصروفات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><span className="text-muted-foreground">عدد السجلات:</span> <strong>{expenseReport.summary.count}</strong></p>
                  <p><span className="text-muted-foreground">إجمالي المصروفات:</span> <strong>₪ {formatMinor(expenseReport.summary.totalAmount)}</strong></p>
                </CardContent>
              </Card>
            </div>
          )}
          {currentPath === "/reports/expenses" && expenseReport && expenseReport.expenses?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل المصروفات</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="data-table-header">
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">التصنيف</TableHead>
                      <TableHead className="text-center">المبلغ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseReport.expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{typeof e.date === "string" ? e.date.slice(0, 10) : ""}</TableCell>
                        <TableCell>{e.type}</TableCell>
                        <TableCell>{e.categoryName ?? "—"}</TableCell>
                        <TableCell className="text-center">₪ {formatMinor(e.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Profit & Loss */}
          {currentPath === "/reports/profit-loss" && profitLossReport && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  قائمة الدخل (الأرباح والخسائر)
                </CardTitle>
                <CardDescription>للفترة المحددة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">الإيرادات</p>
                    <p className="text-xl font-semibold text-success">₪ {formatMinor(profitLossReport.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">تكلفة البضاعة</p>
                    <p className="text-xl font-semibold">₪ {formatMinor(profitLossReport.costOfGoodsSold)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الربح الإجمالي</p>
                    <p className="text-xl font-semibold text-green-600">₪ {formatMinor(profitLossReport.grossProfit)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">المصروفات</p>
                    <p className="text-xl font-semibold">₪ {formatMinor(profitLossReport.expenses)}</p>
                  </div>
                </div>
                <div className="border-t pt-4 flex items-center justify-between">
                  <span className="text-muted-foreground">صافي الربح</span>
                  <span className={cn("text-2xl font-bold", profitLossReport.netProfit >= 0 ? "text-green-600" : "text-red-600")}>
                    ₪ {formatMinor(profitLossReport.netProfit)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  هامش الربح الإجمالي: {profitLossReport.grossMargin.toFixed(1)}% — هامش الربح الصافي: {profitLossReport.netMargin.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          )}

          {/* Wastage */}
          {currentPath === "/reports/wastage" && wastageReport && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trash2 className="w-5 h-5" />
                    ملخص الهدر
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p><span className="text-muted-foreground">عدد السجلات:</span> <strong>{wastageReport.summary.count}</strong></p>
                  <p><span className="text-muted-foreground">إجمالي الوزن (غ):</span> <strong>{wastageReport.summary.totalWeight}</strong></p>
                  <p><span className="text-muted-foreground">التكلفة التقديرية:</span> <strong>₪ {formatMinor(wastageReport.summary.totalCost)}</strong></p>
                </CardContent>
              </Card>
            </div>
          )}
          {currentPath === "/reports/wastage" && wastageReport && wastageReport.records?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل الهدر</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="data-table-header">
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الصنف</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">السبب</TableHead>
                      <TableHead className="text-center">الوزن (غ)</TableHead>
                      <TableHead className="text-center">التكلفة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wastageReport.records.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{typeof r.date === "string" ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10)}</TableCell>
                        <TableCell>{r.itemName}</TableCell>
                        <TableCell>{r.type}</TableCell>
                        <TableCell>{wastageReasonLabels[r.reason ?? ""] ?? r.reason ?? "—"}</TableCell>
                        <TableCell className="text-center font-english" dir="ltr">{r.weight}</TableCell>
                        <TableCell className="text-center">₪ {formatMinor(r.cost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Stock vs GL (Blueprint 06) */}
          {currentPath === "/reports/stock-vs-gl" && stockVsGLReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">قيمة المخزون (SLE)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">₪ {formatMinor(stockVsGLReport.summary.totalStockValue)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">قيمة الدفاتر (GL)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">₪ {formatMinor(stockVsGLReport.summary.totalAccountValue)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">الفرق</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-xl font-bold ${stockVsGLReport.summary.totalDifference !== 0 ? "text-amber-600" : "text-green-600"}`}>
                      ₪ {formatMinor(stockVsGLReport.summary.totalDifference)}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>تفاصيل الفروقات</CardTitle>
                  <CardDescription>مقارنة حركات المخزون مع قيود اليومية حسب الـ voucher</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="data-table-header">
                        <TableHead className="text-right">النوع</TableHead>
                        <TableHead className="text-right">رقم الـ Voucher</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-center">قيمة المخزون</TableHead>
                        <TableHead className="text-center">قيمة الدفاتر</TableHead>
                        <TableHead className="text-center">الفرق</TableHead>
                        <TableHead className="text-right">المصدر</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockVsGLReport.rows.map((r, i) => (
                        <TableRow key={`${r.voucherType}-${r.voucherId}-${i}`}>
                          <TableCell>{r.voucherType}</TableCell>
                          <TableCell className="font-mono">{r.voucherId}</TableCell>
                          <TableCell>{typeof r.postingDate === "string" ? r.postingDate.slice(0, 10) : ""}</TableCell>
                          <TableCell className="text-center">₪ {formatMinor(r.stockValue)}</TableCell>
                          <TableCell className="text-center">₪ {formatMinor(r.accountValue)}</TableCell>
                          <TableCell className={`text-center ${r.difference !== 0 ? "text-amber-600 font-medium" : ""}`}>₪ {formatMinor(r.difference)}</TableCell>
                          <TableCell>{r.ledgerType}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {stockVsGLReport.rows.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">لا توجد حركات مخزون مرحلة حتى هذا التاريخ</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* VAT Report - Blueprint 05 */}
          {currentPath === "/reports/vat" && vatReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Output VAT (ضريبة المخرجات)</CardTitle>
                    <CardDescription>من المبيعات</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-amber-600">₪ {formatMinor(vatReport.outputVat)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Input VAT (ضريبة المدخلات)</CardTitle>
                    <CardDescription>من المشتريات</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-blue-600">₪ {formatMinor(vatReport.inputVat)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">صافي المستحق</CardTitle>
                    <CardDescription>Output - Input</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-xl font-bold ${vatReport.netVatPayable >= 0 ? "text-green-600" : "text-red-600"}`}>
                      ₪ {formatMinor(vatReport.netVatPayable)}
                    </p>
                  </CardContent>
                </Card>
              </div>
              {vatReport.byAccount && vatReport.byAccount.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>تفصيل حسب الحساب</CardTitle>
                    <CardDescription>Output و Input VAT لكل حساب ضريبة</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="data-table-header">
                          <TableHead className="text-right">الحساب</TableHead>
                          <TableHead className="text-right">الكود</TableHead>
                          <TableHead className="text-center">Output</TableHead>
                          <TableHead className="text-center">Input</TableHead>
                          <TableHead className="text-center">الصافي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vatReport.byAccount.map((a) => (
                          <TableRow key={a.accountId}>
                            <TableCell>{a.accountName}</TableCell>
                            <TableCell className="font-mono">{a.accountCode}</TableCell>
                            <TableCell className="text-center">₪ {formatMinor(a.output)}</TableCell>
                            <TableCell className="text-center">₪ {formatMinor(a.input)}</TableCell>
                            <TableCell className="text-center">₪ {formatMinor(a.output - a.input)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Landing grid — shown on /reports base path */}
          {!reportLinks.some((l) => l.href === currentPath) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {reportLinks.map((link) => {
                const LinkIcon = link.icon;
                return (
                  <Link key={link.href} to={link.href} className="group">
                    <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <LinkIcon className="w-5 h-5 text-primary" />
                          </div>
                          <CardTitle className="text-base">{link.label}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{link.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Empty state when report type matches but no data */}
          {currentPath === "/reports/sales" && !isLoading && (!salesReport?.sales?.length && salesReport?.summary?.count === 0) && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">لا توجد مبيعات في الفترة المحددة</CardContent>
            </Card>
          )}
          {currentPath === "/reports/purchases" && !isLoading && (!purchasesReport?.purchases?.length && purchasesReport?.summary?.count === 0) && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">لا توجد مشتريات في الفترة المحددة</CardContent>
            </Card>
          )}
        </>
      )}

      {pdfConfig && (
        <PdfPreviewDialog
          open={pdfDialogOpen}
          onOpenChange={setPdfDialogOpen}
          reportType={pdfConfig.type}
          params={pdfConfig.getParams(rangeForQuery, stockVsGLDate)}
          title={pdfConfig.title}
        />
      )}
    </div>
  );
}
