import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Download, MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
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
import { PaymentStatusBadge } from "@/components/ui/status-badge";

// Mock data
const salesData = [
  { id: "INV-2026-0042", customer: "أحمد محمود", phone: "0599123456", date: "2026-02-04", gross: 165, discount: 9, net: 156, paid: 156, remaining: 0, status: "Paid" as const },
  { id: "INV-2026-0041", customer: "محمد علي", phone: "0598765432", date: "2026-02-04", gross: 100, discount: 0, net: 100, paid: 50, remaining: 50, status: "PartiallyPaid" as const },
  { id: "INV-2026-0040", customer: "خالد حسن", phone: "0597654321", date: "2026-02-03", gross: 250, discount: 16, net: 234, paid: 0, remaining: 234, status: "Unpaid" as const },
  { id: "INV-2026-0039", customer: "سعيد عمر", phone: "0596543210", date: "2026-02-03", gross: 88, discount: 0, net: 88, paid: 88, remaining: 0, status: "Paid" as const },
  { id: "INV-2026-0038", customer: "عمر فاروق", phone: "0595432109", date: "2026-02-02", gross: 320, discount: 20, net: 300, paid: 300, remaining: 0, status: "Paid" as const },
];

export default function Sales() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredSales = salesData.filter((sale) => {
    const matchesSearch =
      sale.customer.includes(searchQuery) ||
      sale.phone.includes(searchQuery) ||
      sale.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || sale.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المبيعات</h1>
          <p className="text-muted-foreground mt-1">سجل جميع عمليات البيع</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            تصدير
          </Button>
          <Link to="/sales/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              بيع جديد
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو رقم الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="حالة الدفع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="Paid">مدفوع</SelectItem>
                <SelectItem value="PartiallyPaid">مدفوع جزئياً</SelectItem>
                <SelectItem value="Unpaid">غير مدفوع</SelectItem>
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
                <TableHead className="text-right">رقم الفاتورة</TableHead>
                <TableHead className="text-right">الزبون</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-center">التاريخ</TableHead>
                <TableHead className="text-center">الإجمالي</TableHead>
                <TableHead className="text-center">الخصم</TableHead>
                <TableHead className="text-center">الصافي</TableHead>
                <TableHead className="text-center">المدفوع</TableHead>
                <TableHead className="text-center">المتبقي</TableHead>
                <TableHead className="text-center">الحالة</TableHead>
                <TableHead className="text-center w-12">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.map((sale) => (
                <TableRow key={sale.id} className="data-table-row">
                  <TableCell className="font-mono text-sm">{sale.id}</TableCell>
                  <TableCell className="font-medium">{sale.customer}</TableCell>
                  <TableCell className="text-muted-foreground font-english" dir="ltr">
                    {sale.phone}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {sale.date}
                  </TableCell>
                  <TableCell className="text-center">₪ {sale.gross}</TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {sale.discount > 0 ? `₪ ${sale.discount}` : "-"}
                  </TableCell>
                  <TableCell className="text-center font-semibold">₪ {sale.net}</TableCell>
                  <TableCell className="text-center text-success">₪ {sale.paid}</TableCell>
                  <TableCell className="text-center">
                    {sale.remaining > 0 ? (
                      <span className="text-danger font-semibold">₪ {sale.remaining}</span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <PaymentStatusBadge status={sale.status} />
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
                          <Eye className="w-4 h-4" />
                          عرض التفاصيل
                        </DropdownMenuItem>
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
          عرض {filteredSales.length} من {salesData.length} فاتورة
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
