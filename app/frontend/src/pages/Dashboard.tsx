import {
  Users,
  Package,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  Wallet,
  ShoppingCart,
  Calendar,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge, PaymentStatusBadge, StockStatusBadge } from "@/components/ui/status-badge";
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
import { Link } from "react-router-dom";

// Mock data
const lowStockItems = [
  { id: 1, name: "صدور دجاج", category: "طازج", current: 2, min: 5, unit: "كغم" },
  { id: 2, name: "أفخاذ دجاج", category: "طازج", current: 3, min: 5, unit: "كغم" },
  { id: 3, name: "دجاج مشوي", category: "مطبوخ", current: 0, min: 3, unit: "قطعة" },
];

const customerDebts = [
  { id: 1, name: "أحمد محمود", phone: "0599123456", amount: 350, dueDate: "2026-02-10" },
  { id: 2, name: "محمد علي", phone: "0598765432", amount: 180, dueDate: "2026-02-08" },
  { id: 3, name: "خالد حسن", phone: "0597654321", amount: 520, dueDate: "2026-02-15" },
];

const supplierDebts = [
  { id: 1, name: "مزرعة الخير", amount: 2500, dueDate: "2026-02-07" },
  { id: 2, name: "شركة التوزيع", amount: 1800, dueDate: "2026-02-12" },
];

const recentSales = [
  { id: "INV-2026-0042", customer: "أحمد محمود", amount: 156, status: "Paid" as const, date: "2026-02-04" },
  { id: "INV-2026-0041", customer: "محمد علي", amount: 89, status: "PartiallyPaid" as const, date: "2026-02-04" },
  { id: "INV-2026-0040", customer: "خالد حسن", amount: 234, status: "Unpaid" as const, date: "2026-02-03" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="عدد الزبائن"
          value={128}
          icon={Users}
          variant="info"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="عناصر المخزون"
          value={45}
          icon={Package}
          variant="default"
        />
        <StatCard
          title="أرباح المبيعات"
          value="₪ 8,450"
          subtitle="هذا الشهر"
          icon={TrendingUp}
          variant="success"
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="قطع منخفضة المخزون"
          value={3}
          icon={AlertTriangle}
          variant="warning"
        />
      </div>

      {/* Second Row Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          title="ديون الزبائن"
          value="₪ 1,050"
          subtitle="3 زبائن"
          icon={CreditCard}
          variant="danger"
        />
        <StatCard
          title="ديون للتجار"
          value="₪ 4,300"
          subtitle="2 تاجر"
          icon={Wallet}
          variant="warning"
        />
      </div>

      {/* Data Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Items */}
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
                {lowStockItems.map((item) => (
                  <TableRow key={item.id} className="data-table-row">
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.category}</TableCell>
                    <TableCell className="text-center">
                      {item.current} / {item.min} {item.unit}
                    </TableCell>
                    <TableCell className="text-center">
                      <StockStatusBadge current={item.current} min={item.min} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="outline">
                        طلب
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Customer Debts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-danger" />
              ديون الزبائن
            </CardTitle>
            <Link to="/customers/credits">
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
                {customerDebts.map((debt) => (
                  <TableRow key={debt.id} className="data-table-row">
                    <TableCell className="font-medium">{debt.name}</TableCell>
                    <TableCell className="text-muted-foreground font-english" dir="ltr">
                      {debt.phone}
                    </TableCell>
                    <TableCell className="text-center text-danger font-semibold">
                      ₪ {debt.amount}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {debt.dueDate}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="outline">
                        تحصيل
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Third Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supplier Debts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Wallet className="w-5 h-5 text-warning" />
              ديون للتجار
            </CardTitle>
            <Link to="/traders/payables">
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
                {supplierDebts.map((debt) => (
                  <TableRow key={debt.id} className="data-table-row">
                    <TableCell className="font-medium">{debt.name}</TableCell>
                    <TableCell className="text-center text-warning font-semibold">
                      ₪ {debt.amount}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {debt.dueDate}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="outline">
                        دفع
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Sales */}
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
                {recentSales.map((sale) => (
                  <TableRow key={sale.id} className="data-table-row">
                    <TableCell className="font-mono text-sm">{sale.id}</TableCell>
                    <TableCell className="font-medium">{sale.customer}</TableCell>
                    <TableCell className="text-center font-semibold">
                      ₪ {sale.amount}
                    </TableCell>
                    <TableCell className="text-center">
                      <PaymentStatusBadge status={sale.status} />
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
