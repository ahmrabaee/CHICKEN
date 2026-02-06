import { useState } from "react";
import { Plus, Download, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";

// Mock data
const expensesData = [
  { id: 1, date: "2026-02-04", payee: "صاحب المحل", category: "إيجار", amount: 2000, method: "تحويل بنكي", notes: "إيجار شهر فبراير" },
  { id: 2, date: "2026-02-03", payee: "شركة الكهرباء", category: "مرافق", amount: 450, method: "نقداً", notes: "فاتورة يناير" },
  { id: 3, date: "2026-02-02", payee: "أحمد (عامل)", category: "رواتب", amount: 3000, method: "نقداً", notes: "راتب يناير" },
  { id: 4, date: "2026-02-01", payee: "محل التعبئة", category: "مستلزمات", amount: 150, method: "نقداً", notes: "أكياس وعلب" },
];

const categoryColors: Record<string, "info" | "warning" | "success" | "danger" | "default"> = {
  "إيجار": "info",
  "مرافق": "warning",
  "رواتب": "success",
  "مستلزمات": "default",
};

export default function PersonalExpenses() {
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredExpenses = expensesData.filter((expense) =>
    categoryFilter === "all" || expense.category === categoryFilter
  );

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المصاريف الشخصية</h1>
          <p className="text-muted-foreground mt-1">إدارة مصاريف المحل والنفقات</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            تصدير
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            مصروف جديد
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">إجمالي المصاريف</p>
              <p className="text-3xl font-bold text-primary">₪ {totalExpenses.toLocaleString()}</p>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="الفئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفئات</SelectItem>
                <SelectItem value="إيجار">إيجار</SelectItem>
                <SelectItem value="مرافق">مرافق</SelectItem>
                <SelectItem value="رواتب">رواتب</SelectItem>
                <SelectItem value="مستلزمات">مستلزمات</SelectItem>
                <SelectItem value="أخرى">أخرى</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="data-table-header">
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">المدفوع لـ</TableHead>
                <TableHead className="text-center">الفئة</TableHead>
                <TableHead className="text-center">المبلغ</TableHead>
                <TableHead className="text-center">طريقة الدفع</TableHead>
                <TableHead className="text-right">ملاحظات</TableHead>
                <TableHead className="text-center w-12">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.map((expense) => (
                <TableRow key={expense.id} className="data-table-row">
                  <TableCell className="text-muted-foreground">{expense.date}</TableCell>
                  <TableCell className="font-medium">{expense.payee}</TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={categoryColors[expense.category] || "default"}>
                      {expense.category}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-center font-semibold text-danger">
                    ₪ {expense.amount}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {expense.method}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {expense.notes}
                  </TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2">
                          <Edit className="w-4 h-4" />
                          تعديل
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-danger">
                          <Trash2 className="w-4 h-4" />
                          حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          عرض {filteredExpenses.length} من {expensesData.length} مصروف
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            السابق
          </Button>
          <Button variant="outline" size="sm" disabled>
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}
