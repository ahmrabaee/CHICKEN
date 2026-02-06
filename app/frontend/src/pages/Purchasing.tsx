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
const purchasesData = [
  { id: "PO-2026-0018", supplier: "مزرعة الخير", date: "2026-02-04", total: 3500, paid: 1000, remaining: 2500, dueDate: "2026-02-07", status: "PartiallyPaid" as const },
  { id: "PO-2026-0017", supplier: "شركة التوزيع", date: "2026-02-03", total: 1800, paid: 0, remaining: 1800, dueDate: "2026-02-12", status: "Unpaid" as const },
  { id: "PO-2026-0016", supplier: "مزرعة الفجر", date: "2026-02-02", total: 2200, paid: 2200, remaining: 0, dueDate: null, status: "Paid" as const },
  { id: "PO-2026-0015", supplier: "شركة البهارات", date: "2026-02-01", total: 450, paid: 100, remaining: 350, dueDate: "2026-02-08", status: "PartiallyPaid" as const },
];

export default function Purchasing() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredPurchases = purchasesData.filter((purchase) => {
    const matchesSearch =
      purchase.supplier.includes(searchQuery) ||
      purchase.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || purchase.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المشتريات</h1>
          <p className="text-muted-foreground mt-1">سجل جميع عمليات الشراء</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            تصدير
          </Button>
          <Link to="/purchasing/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              شراء جديد
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
                placeholder="بحث بالتاجر..."
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
                <TableHead className="text-right">التاجر</TableHead>
                <TableHead className="text-center">التاريخ</TableHead>
                <TableHead className="text-center">المبلغ الإجمالي</TableHead>
                <TableHead className="text-center">المدفوع</TableHead>
                <TableHead className="text-center">المتبقي</TableHead>
                <TableHead className="text-center">تاريخ السداد</TableHead>
                <TableHead className="text-center">الحالة</TableHead>
                <TableHead className="text-center w-12">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPurchases.map((purchase) => (
                <TableRow key={purchase.id} className="data-table-row">
                  <TableCell className="font-mono text-sm">{purchase.id}</TableCell>
                  <TableCell className="font-medium">{purchase.supplier}</TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {purchase.date}
                  </TableCell>
                  <TableCell className="text-center font-semibold">₪ {purchase.total}</TableCell>
                  <TableCell className="text-center text-success">₪ {purchase.paid}</TableCell>
                  <TableCell className="text-center">
                    {purchase.remaining > 0 ? (
                      <span className="text-warning font-semibold">₪ {purchase.remaining}</span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {purchase.dueDate || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <PaymentStatusBadge status={purchase.status} />
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
          عرض {filteredPurchases.length} من {purchasesData.length} فاتورة
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
