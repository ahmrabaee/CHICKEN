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
const customersData = [
  { id: 1, name: "أحمد محمود", phone: "0599123456", address: "رام الله", creditLimit: 500, currentBalance: 350, salesCount: 24 },
  { id: 2, name: "محمد علي", phone: "0598765432", address: "نابلس", creditLimit: 300, currentBalance: 180, salesCount: 15 },
  { id: 3, name: "خالد حسن", phone: "0597654321", address: "الخليل", creditLimit: 1000, currentBalance: 520, salesCount: 42 },
  { id: 4, name: "سعيد عمر", phone: "0596543210", address: "بيت لحم", creditLimit: 200, currentBalance: 0, salesCount: 8 },
  { id: 5, name: "عمر فاروق", phone: "0595432109", address: "جنين", creditLimit: 400, currentBalance: 0, salesCount: 31 },
];

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all");

  const filteredCustomers = customersData.filter((customer) => {
    const matchesSearch =
      customer.name.includes(searchQuery) ||
      customer.phone.includes(searchQuery);
    const matchesBalance =
      balanceFilter === "all" ||
      (balanceFilter === "with" && customer.currentBalance > 0) ||
      (balanceFilter === "without" && customer.currentBalance === 0);
    return matchesSearch && matchesBalance;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الزبائن</h1>
          <p className="text-muted-foreground mt-1">إدارة بيانات الزبائن وحساباتهم</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            تصدير
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            زبون جديد
          </Button>
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
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="data-table-header">
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">العنوان</TableHead>
                <TableHead className="text-center">الحد الائتماني</TableHead>
                <TableHead className="text-center">الرصيد الحالي</TableHead>
                <TableHead className="text-center">عدد المبيعات</TableHead>
                <TableHead className="text-center w-12">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id} className="data-table-row">
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-muted-foreground font-english" dir="ltr">
                    {customer.phone}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{customer.address}</TableCell>
                  <TableCell className="text-center">₪ {customer.creditLimit}</TableCell>
                  <TableCell className="text-center">
                    {customer.currentBalance > 0 ? (
                      <span className="text-danger font-semibold">₪ {customer.currentBalance}</span>
                    ) : (
                      <StatusBadge status="success">لا يوجد</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{customer.salesCount}</TableCell>
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
          عرض {filteredCustomers.length} من {customersData.length} زبون
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
