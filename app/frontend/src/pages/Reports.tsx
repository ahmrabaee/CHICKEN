import { BarChart3, TrendingUp, Package, PieChart, Receipt, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const reportLinks = [
  { href: "/reports/sales", label: "تقارير المبيعات", icon: TrendingUp },
  { href: "/reports/inventory", label: "تقارير المخزون", icon: Package },
  { href: "/reports/financial", label: "التقارير المالية", icon: PieChart },
  { href: "/reports/tax", label: "تقارير الضرائب", icon: Receipt },
];

export default function Reports() {
  const location = useLocation();
  const currentPath = location.pathname;

  // Determine which report is active
  const getReportContent = () => {
    switch (currentPath) {
      case "/reports/sales":
        return {
          title: "تقارير المبيعات",
          description: "تحليل أداء المبيعات والأرباح",
          icon: TrendingUp,
        };
      case "/reports/inventory":
        return {
          title: "تقارير المخزون",
          description: "تقييم المخزون وحركة البضاعة",
          icon: Package,
        };
      case "/reports/financial":
        return {
          title: "التقارير المالية",
          description: "قائمة الدخل والتدفق النقدي",
          icon: PieChart,
        };
      case "/reports/tax":
        return {
          title: "تقارير الضرائب",
          description: "ملخص ضريبة القيمة المضافة",
          icon: Receipt,
        };
      default:
        return {
          title: "التقارير",
          description: "اختر نوع التقرير",
          icon: BarChart3,
        };
    }
  };

  const content = getReportContent();
  const Icon = content.icon;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{content.title}</h1>
          <p className="text-muted-foreground mt-1">{content.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select defaultValue="month">
            <SelectTrigger className="w-40 gap-2">
              <Calendar className="w-4 h-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">اليوم</SelectItem>
              <SelectItem value="week">هذا الأسبوع</SelectItem>
              <SelectItem value="month">هذا الشهر</SelectItem>
              <SelectItem value="quarter">هذا الربع</SelectItem>
              <SelectItem value="year">هذه السنة</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            تصدير PDF
          </Button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {reportLinks.map((link) => (
          <Link key={link.href} to={link.href}>
            <Button
              variant={currentPath === link.href ? "default" : "outline"}
              className="gap-2 whitespace-nowrap"
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Button>
          </Link>
        ))}
      </div>

      {/* Report Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5" />
              {content.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>الرسوم البيانية ستظهر هنا</p>
                <p className="text-sm">بعد ربط قاعدة البيانات</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>إجمالي المبيعات</CardDescription>
              <CardTitle className="text-2xl text-success">₪ 45,230</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">+12% من الشهر السابق</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>صافي الربح</CardDescription>
              <CardTitle className="text-2xl text-primary">₪ 8,450</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">هامش الربح: 18.7%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>عدد الفواتير</CardDescription>
              <CardTitle className="text-2xl">342</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">متوسط الفاتورة: ₪ 132</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Data Table Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>تفاصيل التقرير</CardTitle>
          <CardDescription>البيانات التفصيلية للفترة المحددة</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted/30 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
            <div className="text-center text-muted-foreground">
              <p>جدول البيانات سيظهر هنا</p>
              <p className="text-sm">بعد ربط قاعدة البيانات</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
