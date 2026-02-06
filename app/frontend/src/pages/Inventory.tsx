import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Plus,
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { StockStatusBadge } from "@/components/ui/status-badge";

// Mock data
const inventoryItems = [
  { id: 1, name: "فروج كامل", nameEn: "Whole Chicken", category: "طازج", current: 25, min: 10, purchasePrice: 18, salePrice: 22, unit: "كغم", location: "ثلاجة A" },
  { id: 2, name: "صدور دجاج", nameEn: "Chicken Breast", category: "طازج", current: 2, min: 5, purchasePrice: 28, salePrice: 35, unit: "كغم", location: "ثلاجة A" },
  { id: 3, name: "أفخاذ دجاج", nameEn: "Chicken Thighs", category: "طازج", current: 8, min: 5, purchasePrice: 22, salePrice: 28, unit: "كغم", location: "ثلاجة A" },
  { id: 4, name: "دجاج مشوي", nameEn: "Grilled Chicken", category: "مطبوخ", current: 0, min: 3, purchasePrice: 15, salePrice: 25, unit: "قطعة", location: "واجهة العرض" },
  { id: 5, name: "أجنحة دجاج", nameEn: "Chicken Wings", category: "طازج", current: 15, min: 8, purchasePrice: 20, salePrice: 26, unit: "كغم", location: "ثلاجة B" },
  { id: 6, name: "بهارات دجاج", nameEn: "Chicken Spice Mix", category: "إضافات", current: 50, min: 10, purchasePrice: 5, salePrice: 12, unit: "قطعة", location: "رف التوابل" },
];

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredItems = inventoryItems.filter((item) => {
    const matchesSearch = item.name.includes(searchQuery) || item.nameEn.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "low" && item.current <= item.min && item.current > 0) ||
      (statusFilter === "out" && item.current === 0) ||
      (statusFilter === "ok" && item.current > item.min);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المخزون</h1>
          <p className="text-muted-foreground mt-1">إدارة عناصر المخزون والكميات</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            تصدير
          </Button>
          <Link to="/inventory/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              عنصر جديد
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
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="الفئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفئات</SelectItem>
                <SelectItem value="طازج">طازج</SelectItem>
                <SelectItem value="مطبوخ">مطبوخ</SelectItem>
                <SelectItem value="مجمد">مجمد</SelectItem>
                <SelectItem value="إضافات">إضافات</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="ok">متوفر</SelectItem>
                <SelectItem value="low">منخفض</SelectItem>
                <SelectItem value="out">نفذ</SelectItem>
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
                <TableHead className="text-right">الصنف</TableHead>
                <TableHead className="text-right">الفئة</TableHead>
                <TableHead className="text-center">الكمية</TableHead>
                <TableHead className="text-center">الحد الأدنى</TableHead>
                <TableHead className="text-center">سعر الشراء</TableHead>
                <TableHead className="text-center">سعر البيع</TableHead>
                <TableHead className="text-right">الموقع</TableHead>
                <TableHead className="text-center">الحالة</TableHead>
                <TableHead className="text-center w-12">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id} className="data-table-row">
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.nameEn}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.category}</TableCell>
                  <TableCell className="text-center font-semibold">
                    {item.current} {item.unit}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {item.min} {item.unit}
                  </TableCell>
                  <TableCell className="text-center">₪ {item.purchasePrice}</TableCell>
                  <TableCell className="text-center font-semibold">₪ {item.salePrice}</TableCell>
                  <TableCell className="text-muted-foreground">{item.location}</TableCell>
                  <TableCell className="text-center">
                    <StockStatusBadge current={item.current} min={item.min} />
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
          عرض {filteredItems.length} من {inventoryItems.length} عنصر
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
