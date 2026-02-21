import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  Download,
  MoreHorizontal,
  Eye,
  Edit,
  History,
  Layers,
  AlertTriangle,
  Clock,
  Loader2,
  TrendingDown,
  Calendar
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
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CategoriesManagement } from "@/components/inventory/CategoriesManagement";

import {
  useInventory,
  useCategories,
  useLowStockItems,
  useExpiringItems
} from "@/hooks/use-inventory";
import { useRole } from "@/hooks/useRole";
import { InventoryQuery, InventoryItem } from "@/types/inventory";
import AdjustStockDialog from "@/components/inventory/AdjustStockDialog";
import InventoryLotsDialog from "@/components/inventory/InventoryLotsDialog";
import InventoryMovementsDialog from "@/components/inventory/InventoryMovementsDialog";

export default function Inventory() {
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "categories" ? "categories" : "items";

  const handleTabChange = (value: string) => {
    if (value === "categories") {
      setSearchParams({ tab: "categories" });
    } else {
      setSearchParams({});
    }
  };

  const [queryParams, setQueryParams] = useState<InventoryQuery>({
    page: 1,
    pageSize: 10,
    search: "",
  });

  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [viewingLotsItem, setViewingLotsItem] = useState<InventoryItem | null>(null);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<InventoryItem | null>(null);

  const { data: response, isLoading } = useInventory(queryParams);
  const { data: categories } = useCategories();
  const { data: lowStockItems = [] } = useLowStockItems();
  const { data: expiringItems = [] } = useExpiringItems(30); // Check 30 days ahead

  const items = response?.data || [];
  const pagination = response?.pagination;

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQueryParams(prev => ({ ...prev, search: e.target.value, page: 1 }));
  };

  const handleCategoryChange = (value: string) => {
    setQueryParams(prev => ({
      ...prev,
      categoryId: value === "all" ? undefined : parseInt(value),
      page: 1
    }));
  };

  const handleStatusChange = (value: string) => {
    setQueryParams(prev => ({
      ...prev,
      lowStock: value === "low" ? true : undefined,
      expiringSoon: value === "expiring" ? true : undefined,
      page: 1
    }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المخزون وإدارة الأصناف</h1>
          <p className="text-muted-foreground mt-1">تتبع مستويات المخزون، الدفعات (FIFO)، وسجل الحركات</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            تصدير البيانات
          </Button>
          {isAdmin && (
            <Link to="/inventory/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                إضافة صنف جديد
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="items">الأصناف</TabsTrigger>
          <TabsTrigger value="categories">الفئات</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-6 mt-0">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الأصناف</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-800">{pagination?.totalItems || 0}</h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-full">
                <Layers className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${lowStockItems.length > 0 ? "border-l-orange-500" : "border-l-emerald-500"}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">أصناف تحت حد الطلب</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-800">{lowStockItems.length}</h3>
              </div>
              <div className={`p-3 ${lowStockItems.length > 0 ? "bg-orange-50 text-orange-500" : "bg-emerald-50 text-emerald-500"} rounded-full`}>
                <TrendingDown className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${expiringItems.length > 0 ? "border-l-rose-500" : "border-l-emerald-500"}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">أصناف تقترب من الانتهاء</p>
                <h3 className="text-2xl font-bold mt-1 text-slate-800">{expiringItems.length}</h3>
              </div>
              <div className={`p-3 ${expiringItems.length > 0 ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"} rounded-full`}>
                <Calendar className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو الكود..."
                value={queryParams.search}
                onChange={handleSearch}
                className="pr-10 text-right"
              />
            </div>
            <Select
              value={queryParams.categoryId?.toString() || "all"}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="w-full md:w-48 text-right" dir="rtl">
                <SelectValue placeholder="التصنيف" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">جميع التصنيفات</SelectItem>
                {categories?.map(cat => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={queryParams.lowStock ? "low" : (queryParams.expiringSoon ? "expiring" : "all")}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-full md:w-48 text-right" dir="rtl">
                <SelectValue placeholder="تصفية بالحالة" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="low">مخزون منخفض</SelectItem>
                <SelectItem value="expiring">ينتهي قريباً</SelectItem>
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
              <TableRow className="bg-slate-50 border-b">
                <TableHead className="text-right">الصنف</TableHead>
                <TableHead className="text-center">إجمالي الكمية</TableHead>
                <TableHead className="text-center">سعر الشراء (Avg)</TableHead>
                <TableHead className="text-center">سعر البيع</TableHead>
                <TableHead className="text-center">الحالة</TableHead>
                <TableHead className="text-center w-12">خيارات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      جاري تحميل البيانات...
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    لا توجد بيانات تطابق الفلتر الحالي
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.itemId} className="hover:bg-slate-50 transition-colors">
                    <TableCell>
                      <Link to={`/inventory/${item.itemId}`} className="flex flex-col hover:opacity-80 transition-opacity">
                        <span className="font-bold text-slate-900">{item.itemName}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            {item.itemCode}
                          </code>
                          <span className="text-[11px] text-slate-400 font-medium px-1.5 py-0.5 border border-slate-100 rounded uppercase">
                            {item.categoryName}
                          </span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-lg">{(item.totalQuantity / 1000).toFixed(2)}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{item.unitOfMeasure === 'جرام' ? 'كجم' : item.unitOfMeasure}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-slate-500">₪{(item.avgCostPrice ? item.avgCostPrice / 1000 : 0).toFixed(2)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold text-primary font-mono text-lg">
                        ₪{(item.sellingPrice / 1000).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <StockStatusBadge current={item.availableQuantity} min={item.minStockLevel} />
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-right">
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate(`/inventory/${item.itemId}`)}>
                            <Edit className="w-4 h-4 text-slate-500" />
                            تعديل بيانات الصنف الأساسية
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setViewingLotsItem(item)}>
                            <Layers className="w-4 h-4 text-blue-500" />
                            عرض الدفعات تفصيلاً (FIFO)
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setViewingHistoryItem(item)}>
                            <History className="w-4 h-4 text-emerald-500" />
                            سجل حركات المخزون
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setAdjustingItem(item)}>
                              <Edit className="w-4 h-4 text-orange-500" />
                              تعديل الكمية (تسوية يدوية)
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground font-arabic">
            عرض {items.length} من {pagination.totalItems} عنصر
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrev}
              onClick={() => setQueryParams(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
            >
              السابق
            </Button>
            <div className="text-sm px-4">
              صفحة {pagination.page} من {pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNext}
              onClick={() => setQueryParams(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
            >
              التالي
            </Button>
          </div>
        </div>
      )}

      {/* Deep-Dive Dialogs */}
      <AdjustStockDialog
        item={adjustingItem}
        onClose={() => setAdjustingItem(null)}
      />

      <InventoryLotsDialog
        item={viewingLotsItem}
        onClose={() => setViewingLotsItem(null)}
      />

      <InventoryMovementsDialog
        item={viewingHistoryItem}
        onClose={() => setViewingHistoryItem(null)}
      />
        </TabsContent>

        <TabsContent value="categories" className="mt-0">
          <CategoriesManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
