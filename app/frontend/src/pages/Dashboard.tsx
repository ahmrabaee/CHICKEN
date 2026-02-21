import {
  AlertTriangle,
  Calendar,
  CreditCard,
  Loader2,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentStatusBadge, StockStatusBadge } from "@/components/ui/status-badge";
import { useReceivables, usePayables } from "@/hooks/use-debts";
import { useLowStockItems } from "@/hooks/use-inventory";
import { useDashboard } from "@/hooks/use-reports";
import { useRole } from "@/hooks/useRole";
import { useSales } from "@/hooks/use-sales";
import { formatCurrency } from "@/lib/formatters";

function formatMinor(amount: number): string {
  return formatCurrency(amount);
}

function formatDate(date?: string | null): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toISOString().split("T")[0];
}

function formatGramsAsKg(grams: number): string {
  return `${(grams / 1000).toFixed(2)} كغم`;
}

function toPaymentBadgeStatus(
  status?: string,
): "Paid" | "PartiallyPaid" | "Unpaid" {
  if (status === "paid") return "Paid";
  if (status === "partial") return "PartiallyPaid";
  return "Unpaid";
}

function getOutstandingAmount(debt: Record<string, unknown>): number {
  if (typeof debt.remainingAmount === "number") return debt.remainingAmount;

  const totalAmount =
    typeof debt.totalAmount === "number"
      ? debt.totalAmount
      : typeof debt.originalAmount === "number"
        ? debt.originalAmount
        : 0;
  const amountPaid =
    typeof debt.amountPaid === "number"
      ? debt.amountPaid
      : typeof debt.paidAmount === "number"
        ? debt.paidAmount
        : 0;

  return Math.max(0, totalAmount - amountPaid);
}

function getDebtPartyName(debt: Record<string, unknown>): string {
  const raw =
    (typeof debt.partyName === "string" && debt.partyName) ||
    (typeof debt.customerName === "string" && debt.customerName) ||
    (typeof debt.supplierName === "string" && debt.supplierName) ||
    (typeof debt.name === "string" && debt.name) ||
    "";

  return raw || "-";
}

function getDebtPhone(debt: Record<string, unknown>): string {
  return (
    (typeof debt.customerPhone === "string" && debt.customerPhone) ||
    (typeof debt.phone === "string" && debt.phone) ||
    "-"
  );
}

export default function Dashboard() {
  const { isAdmin } = useRole();
  const previewSize = 3;

  const { data: dashboard, isLoading: dashboardLoading } = useDashboard();
  const { data: lowStockData, isLoading: lowStockLoading, isError: lowStockError } =
    useLowStockItems();
  const {
    data: receivablesData,
    isLoading: receivablesLoading,
    isError: receivablesError,
  } = useReceivables({ page: 1, pageSize: previewSize });
  const {
    data: payablesData,
    isLoading: payablesLoading,
    isError: payablesError,
  } = usePayables({ page: 1, pageSize: previewSize });
  const { data: salesData, isLoading: salesLoading, isError: salesError } = useSales({
    page: 1,
    pageSize: previewSize,
  });

  const lowStockItems = (lowStockData ?? []).slice(0, previewSize);
  const customerDebts = (((receivablesData?.data as unknown[]) ?? []).slice(
    0,
    previewSize,
  ) as Array<Record<string, unknown>>);
  const supplierDebts = (((payablesData?.data as unknown[]) ?? []).slice(
    0,
    previewSize,
  ) as Array<Record<string, unknown>>);
  const recentSales = (((salesData?.data as unknown[]) ?? []).slice(
    0,
    previewSize,
  ) as Array<Record<string, unknown>>);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-muted-foreground mt-1">نظرة عامة على أداء المحل</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Calendar className="w-4 h-4" />
            اليوم
          </Button>
          <Link to="/sales/new">
            <Button className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              بيع جديد
            </Button>
          </Link>
        </div>
      </div>

      {dashboardLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="مبيعات اليوم (عدد)"
              value={dashboard?.sales?.today?.count ?? 0}
              icon={ShoppingCart}
              variant="default"
            />
            <StatCard
              title="إيرادات اليوم"
              value={dashboard?.sales?.today ? formatMinor(dashboard.sales.today.totalAmount) : formatMinor(0)}
              icon={TrendingUp}
              variant="success"
            />
            {isAdmin && (
              <StatCard
                title="أرباح اليوم"
                value={dashboard?.sales?.today ? formatMinor(dashboard.sales.today.totalProfit) : formatMinor(0)}
                icon={TrendingUp}
                variant="success"
              />
            )}
            <StatCard
              title="قطع منخفضة المخزون"
              value={dashboard?.inventory?.lowStockCount ?? 0}
              icon={AlertTriangle}
              variant="warning"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              title="ديون الزبائن (مستحقات)"
              value={dashboard != null ? formatMinor(dashboard.receivables) : formatMinor(0)}
              icon={CreditCard}
              variant="danger"
            />
            {isAdmin && (
              <StatCard
                title="ديون للتجار (ذمم دائنة)"
                value={dashboard != null ? formatMinor(dashboard.payables) : formatMinor(0)}
                icon={Wallet}
                variant="warning"
              />
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              قطع قريبة من النفاذ
            </CardTitle>
            <Link to="/inventory">
              <Button variant="ghost" size="sm">
                عرض الكل
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="data-table-header">
                  <TableHead className="text-right">الصنف</TableHead>
                  <TableHead className="text-right">الفئة</TableHead>
                  <TableHead className="text-center">الكمية</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead className="text-center">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                )}
                {!lowStockLoading && lowStockError && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      تعذر تحميل البيانات
                    </TableCell>
                  </TableRow>
                )}
                {!lowStockLoading && !lowStockError && lowStockItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      لا توجد أصناف منخفضة حالياً
                    </TableCell>
                  </TableRow>
                )}
                {!lowStockLoading &&
                  !lowStockError &&
                  lowStockItems.map((item) => (
                    <TableRow key={item.itemId} className="data-table-row">
                      <TableCell className="font-medium">{item.itemName}</TableCell>
                      <TableCell className="text-muted-foreground">{item.categoryName}</TableCell>
                      <TableCell className="text-center">
                        {formatGramsAsKg(item.currentQuantityGrams)} / {formatGramsAsKg(item.minStockLevel)}
                      </TableCell>
                      <TableCell className="text-center">
                        <StockStatusBadge
                          current={item.currentQuantityGrams}
                          min={item.minStockLevel}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Link to="/inventory">
                          <Button size="sm" variant="outline">
                            متابعة
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-danger" />
              ديون الزبائن
            </CardTitle>
            <Link to="/debts">
              <Button variant="ghost" size="sm">
                عرض الكل
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="data-table-header">
                  <TableHead className="text-right">الزبون</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-center">المبلغ</TableHead>
                  <TableHead className="text-center">تاريخ السداد</TableHead>
                  <TableHead className="text-center">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivablesLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                )}
                {!receivablesLoading && receivablesError && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      تعذر تحميل البيانات
                    </TableCell>
                  </TableRow>
                )}
                {!receivablesLoading && !receivablesError && customerDebts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      لا توجد ديون زبائن
                    </TableCell>
                  </TableRow>
                )}
                {!receivablesLoading &&
                  !receivablesError &&
                  customerDebts.map((debt, index) => (
                    <TableRow key={String(debt.id ?? `recv-${index}`)} className="data-table-row">
                      <TableCell className="font-medium">{getDebtPartyName(debt)}</TableCell>
                      <TableCell className="text-muted-foreground font-english" dir="ltr">
                        {getDebtPhone(debt)}
                      </TableCell>
                      <TableCell className="text-center text-danger font-semibold">
                        {formatMinor(getOutstandingAmount(debt))}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {formatDate(typeof debt.dueDate === "string" ? debt.dueDate : null)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Link to="/debts">
                          <Button size="sm" variant="outline">
                            تحصيل
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Wallet className="w-5 h-5 text-warning" />
              ديون للتجار
            </CardTitle>
            <Link to="/debts">
              <Button variant="ghost" size="sm">
                عرض الكل
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="data-table-header">
                  <TableHead className="text-right">التاجر</TableHead>
                  <TableHead className="text-center">المبلغ</TableHead>
                  <TableHead className="text-center">تاريخ السداد</TableHead>
                  <TableHead className="text-center">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payablesLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                )}
                {!payablesLoading && payablesError && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      تعذر تحميل البيانات
                    </TableCell>
                  </TableRow>
                )}
                {!payablesLoading && !payablesError && supplierDebts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      لا توجد ديون موردين
                    </TableCell>
                  </TableRow>
                )}
                {!payablesLoading &&
                  !payablesError &&
                  supplierDebts.map((debt, index) => (
                    <TableRow key={String(debt.id ?? `pay-${index}`)} className="data-table-row">
                      <TableCell className="font-medium">{getDebtPartyName(debt)}</TableCell>
                      <TableCell className="text-center text-warning font-semibold">
                        {formatMinor(getOutstandingAmount(debt))}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {formatDate(typeof debt.dueDate === "string" ? debt.dueDate : null)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Link to="/debts">
                          <Button size="sm" variant="outline">
                            دفع
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              آخر المبيعات
            </CardTitle>
            <Link to="/sales">
              <Button variant="ghost" size="sm">
                عرض الكل
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="data-table-header">
                  <TableHead className="text-right">رقم الفاتورة</TableHead>
                  <TableHead className="text-right">الزبون</TableHead>
                  <TableHead className="text-center">المبلغ</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                )}
                {!salesLoading && salesError && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      تعذر تحميل البيانات
                    </TableCell>
                  </TableRow>
                )}
                {!salesLoading && !salesError && recentSales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      لا توجد مبيعات حتى الآن
                    </TableCell>
                  </TableRow>
                )}
                {!salesLoading &&
                  !salesError &&
                  recentSales.map((sale, index) => (
                    <TableRow key={String(sale.id ?? `sale-${index}`)} className="data-table-row">
                      <TableCell className="font-mono text-sm">
                        {typeof sale.saleNumber === "string" ? sale.saleNumber : `SAL-${sale.id ?? "-"}`}
                      </TableCell>
                      <TableCell className="font-medium">
                        {(typeof sale.customerName === "string" && sale.customerName) || "عميل نقدي"}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {formatMinor(typeof sale.totalAmount === "number" ? sale.totalAmount : 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        <PaymentStatusBadge
                          status={toPaymentBadgeStatus(
                            typeof sale.paymentStatus === "string" ? sale.paymentStatus : undefined,
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



