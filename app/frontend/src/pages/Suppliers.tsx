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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";

// Mock data
const suppliersData = [
  { id: 1, name: "مزرعة الخير", phone: "0591234567", paymentTerms: "صافي 30 يوم", currentBalance: 2500, purchasesCount: 18 },
  { id: 2, name: "شركة التوزيع", phone: "0599876543", paymentTerms: "نقداً", currentBalance: 1800, purchasesCount: 12 },
  { id: 3, name: "مزرعة الفجر", phone: "0598765432", paymentTerms: "صافي 15 يوم", currentBalance: 0, purchasesCount: 25 },
  { id: 4, name: "شركة البهارات", phone: "0597654321", paymentTerms: "صافي 7 أيام", currentBalance: 350, purchasesCount: 8 },
];

export default function Suppliers() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSuppliers = suppliersData.filter((supplier) =>
    supplier.name.includes(searchQuery) || supplier.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">التجار</h1>
          <p className="text-muted-foreground mt-1">إدارة بيانات الموردين والتجار</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            تصدير
          </Button>
          <Link to="/traders/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              تاجر جديد
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
                placeholder="بحث بالاسم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="data-table-header">
                <TableHead className="text-right">اسم التاجر</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">شروط الدفع</TableHead>
                <TableHead className="text-center">المستحقات</TableHead>
                <TableHead className="text-center">عدد المشتريات</TableHead>
                <TableHead className="text-center w-12">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id} className="data-table-row">
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell className="text-muted-foreground font-english" dir="ltr">
                    {supplier.phone}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{supplier.paymentTerms}</TableCell>
                  <TableCell className="text-center">
                    {supplier.currentBalance > 0 ? (
                      <span className="text-warning font-semibold">₪ {supplier.currentBalance}</span>
                    ) : (
                      <StatusBadge status="success">لا يوجد</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{supplier.purchasesCount}</TableCell>
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
          عرض {filteredSuppliers.length} من {suppliersData.length} تاجر
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
