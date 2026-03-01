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
  Calendar,
  RefreshCw,
  Trash2
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StockStatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CategoriesManagement } from "@/components/inventory/CategoriesManagement";

import {
  useInventory,
  useCategories,
  useLowStockItems,
  useExpiringItems,
  useDeleteItem
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
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

  const { data: response, isLoading, refetch } = useInventory(queryParams);
  const deleteItemMutation = useDeleteItem();
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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteItemMutation.mutateAsync(deleteTarget.itemId);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المخزون وإدارة الأصناف</h1>
          <p className="text-muted-foreground mt-1">تتبع مستويات المخزون، الدفعات (FIFO)، وسجل الحركات</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            تحديث
          </Button>
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
            <Card className="border-s-4 border-s-blue-500">
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

            <Card className={`border-s-4 ${lowStockItems.length > 0 ? "border-s-orange-500" : "border-s-emerald-500"}`}>
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

            <Card className={`border-s-4 ${expiringItems.length > 0 ? "border-s-rose-500" : "border-s-emerald-500"}`}>
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

          {/* Filters - RTL: بحث من أقصى اليمين، ثم التصنيفات، ثم الحالات */}
          <Card dir="rtl">
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

          {/* Data Table - RTL: الصنف أولاً (يمين)، إجراءات آخراً (يسار) */}
          <Card dir="rtl">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b">
                    <TableHead className="text-right">الصنف</TableHead>
                    <TableHead className="text-center">إجمالي الكمية</TableHead>
                    <TableHead className="text-center">سعر الشراء (Avg)</TableHead>
                    <TableHead className="text-center">سعر البيع</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                    <TableHead className="text-center w-12">إجراءات</TableHead>
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
                          <DropdownMenu dir="rtl">
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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
                              {isAdmin && (
                                <DropdownMenuItem
                                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  حذف صنف
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

          <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
            <AlertDialogContent dir="rtl" className="sm:max-w-[440px] p-0 gap-0 overflow-hidden">
              {/* Header with warning accent */}
              <div className="bg-gradient-to-l from-red-50 to-orange-50 border-b border-red-100 px-6 py-5">
                <AlertDialogHeader className="space-y-2">
                  <AlertDialogTitle className="text-right flex items-center gap-3 text-lg font-bold text-slate-800">
                    <div className="p-2 bg-red-100 rounded-xl shrink-0">
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                    حذف صنف نهائياً
                  </AlertDialogTitle>
                </AlertDialogHeader>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                <AlertDialogDescription asChild>
                  <div className="space-y-4">
                    <p className="text-sm text-slate-700 leading-relaxed">
                      أنت على وشك حذف الصنف{' '}
                      <strong className="text-slate-900 font-bold">"{deleteTarget?.itemName}"</strong>{' '}
                      بشكل نهائي. هذا الإجراء لا يمكن التراجع عنه.
                    </p>

                    {deleteTarget && deleteTarget.totalQuantity > 0 && (
                      <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="p-1.5 bg-amber-100 rounded-lg shrink-0 mt-0.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-amber-800 mb-1">لا يمكن الحذف حالياً</p>
                          <p className="text-xs text-amber-700 leading-relaxed">
                            هذا الصنف يحتوي على رصيد مخزون قدره{' '}
                            <span className="font-bold text-amber-900 text-sm">
                              {(deleteTarget.totalQuantity / 1000).toFixed(2)} {deleteTarget.unitOfMeasure === 'جرام' ? 'كجم' : deleteTarget.unitOfMeasure}
                            </span>
                            . يجب تسوية الكمية إلى صفر أولاً قبل تنفيذ الحذف.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </AlertDialogDescription>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                <AlertDialogFooter className="flex-row gap-3 sm:justify-start">
                  <AlertDialogAction
                    onClick={handleConfirmDelete}
                    disabled={deleteItemMutation.isPending || (!!deleteTarget && deleteTarget.totalQuantity > 0)}
                    className="bg-red-600 text-white hover:bg-red-700 shadow-sm gap-2 font-bold px-5 disabled:opacity-40"
                  >
                    {deleteItemMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جاري الحذف...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        حذف نهائي
                      </>
                    )}
                  </AlertDialogAction>
                  <AlertDialogCancel className="font-medium">تراجع</AlertDialogCancel>
                </AlertDialogFooter>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="categories" className="mt-0">
          <CategoriesManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
