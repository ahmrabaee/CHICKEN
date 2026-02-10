import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Phone,
  MapPin,
  CreditCard,
  Loader2,
  AlertTriangle,
  Crown,
  ShoppingBag,
  Eye,
  Mail,
  Hash,
  Percent,
  FileText,
  Calendar,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  useCustomers,
  useDeleteCustomer,
} from "@/hooks/use-customers";
import { Customer, PriceLevel } from "@/types/customer";

const priceLevelLabels: Record<PriceLevel, string> = {
  standard: "عادي",
  wholesale: "جملة",
  vip: "VIP",
};

const priceLevelColors: Record<PriceLevel, string> = {
  standard: "bg-slate-100 text-slate-700",
  wholesale: "bg-blue-100 text-blue-700",
  vip: "bg-amber-100 text-amber-700",
};

/**
 * Format amount from minor units (e.g. 100000) to display (e.g. "1,000.000")
 */
function formatAmount(amount: number): string {
  return (amount / 1000).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

// ----- Customer Detail Card Component -----
function CustomerDetailCard({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden border-0 rounded-2xl shadow-2xl"
        dir="rtl"
      >
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-l from-emerald-600 via-teal-600 to-cyan-700 p-6 pb-8">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cdefs%3E%3Cpattern%20id%3D%22a%22%20patternUnits%3D%22userSpaceOnUse%22%20width%3D%2220%22%20height%3D%2220%22%3E%3Ccircle%20cx%3D%2210%22%20cy%3D%2210%22%20r%3D%221%22%20fill%3D%22rgba(255%2C255%2C255%2C0.08)%22%2F%3E%3C%2Fpattern%3E%3C%2Fdefs%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22url(%23a)%22%2F%3E%3C%2Fsvg%3E')] opacity-50" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{customer.name}</h2>
                {customer.nameEn && (
                  <p className="text-emerald-100/80 text-sm mt-0.5 font-english">{customer.nameEn}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 font-mono text-xs backdrop-blur-sm">
                    {customer.customerNumber}
                  </Badge>
                  <Badge className={`border-0 text-xs backdrop-blur-sm ${customer.isActive
                    ? "bg-emerald-400/20 text-emerald-100"
                    : "bg-rose-400/20 text-rose-100"
                    }`}>
                    {customer.isActive ? (
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> نشط</span>
                    ) : (
                      <span className="flex items-center gap-1"><XCircle className="w-3 h-3" /> غير نشط</span>
                    )}
                  </Badge>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm ${customer.priceLevel === "vip"
                    ? "bg-amber-400/20 text-amber-100"
                    : customer.priceLevel === "wholesale"
                      ? "bg-sky-400/20 text-sky-100"
                      : "bg-white/15 text-white"
                    }`}>
                    {customer.priceLevel === "vip" && <Crown className="w-3 h-3" />}
                    {customer.priceLevel === "wholesale" && <ShoppingBag className="w-3 h-3" />}
                    {priceLevelLabels[customer.priceLevel]}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary Strip */}
        <div className="grid grid-cols-3 -mt-4 mx-4 gap-3">
          <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">الرصيد المستحق</p>
            <p className={`text-lg font-bold ${customer.currentBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {formatAmount(customer.currentBalance)}
              {customer.currentBalance === 0 && <span className="text-xs mr-1 opacity-60">✓</span>}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">الحد الائتماني</p>
            <p className="text-lg font-bold text-slate-700">
              {customer.creditLimit > 0 ? formatAmount(customer.creditLimit) : <span className="text-slate-300 text-sm">غير محدد</span>}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">الخصم الافتراضي</p>
            <p className="text-lg font-bold text-slate-700">
              {customer.defaultDiscountPct > 0 ? `${(customer.defaultDiscountPct / 100).toFixed(1)}%` : "0%"}
            </p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 pt-6 space-y-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
          {/* Contact Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 px-1">
              <Phone className="w-3.5 h-3.5" />
              معلومات الاتصال
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailItem
                icon={<Phone className="w-4 h-4 text-emerald-500" />}
                label="الهاتف الأساسي"
                value={customer.phone}
                dir="ltr"
              />
              <DetailItem
                icon={<Phone className="w-4 h-4 text-teal-500" />}
                label="الهاتف الثانوي"
                value={customer.phone2}
                dir="ltr"
              />
              <DetailItem
                icon={<Mail className="w-4 h-4 text-cyan-500" />}
                label="البريد الإلكتروني"
                value={customer.email}
                dir="ltr"
              />
              <DetailItem
                icon={<MapPin className="w-4 h-4 text-rose-500" />}
                label="العنوان"
                value={customer.address}
              />
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* Financial & ID Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 px-1">
              <CreditCard className="w-3.5 h-3.5" />
              المعلومات المالية والضريبية
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailItem
                icon={<Hash className="w-4 h-4 text-amber-500" />}
                label="الرقم الضريبي / الهوية"
                value={customer.taxNumber}
                mono
              />
              <DetailItem
                icon={<Percent className="w-4 h-4 text-blue-500" />}
                label="نقاط الخصم"
                value={customer.defaultDiscountPct > 0 ? `${customer.defaultDiscountPct} نقطة` : null}
              />
            </div>
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 px-1">
                <FileText className="w-3.5 h-3.5" />
                ملاحظات إضافية
              </h3>
              <p className="text-sm text-slate-600 bg-slate-50/50 rounded-xl p-4 border border-teal-100/50 leading-relaxed italic">
                "{customer.notes}"
              </p>
            </div>
          )}

          <Separator className="opacity-50" />

          {/* System Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 px-1">
              <Calendar className="w-3.5 h-3.5" />
              سجل النظام
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailItem
                icon={<Calendar className="w-4 h-4 text-slate-400" />}
                label="تاريخ الإنشاء"
                value={new Date(customer.createdAt).toLocaleString("ar-EG")}
              />
              <DetailItem
                icon={<Calendar className="w-4 h-4 text-slate-400" />}
                label="آخر تحديث"
                value={new Date(customer.updatedAt).toLocaleString("ar-EG")}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Reusable detail item component for the card
function DetailItem({ icon, label, value, dir, mono }: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  dir?: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 hover:border-teal-100 hover:bg-white transition-all duration-200">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p
        className={`text-sm text-slate-700 ${mono ? "font-mono" : ""} ${!value ? "text-slate-300 italic" : ""}`}
        dir={dir}
      >
        {value || "غير متوفر"}
      </p>
    </div>
  );
}

// ----- Main Customers Page -----
export default function Customers() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [priceLevelFilter, setPriceLevelFilter] = useState<string>("all");
  const [showWithBalance, setShowWithBalance] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);

  // Query with filters
  const { data: customersResponse, isLoading, error } = useCustomers({
    search: searchQuery || undefined,
    isActive: showInactive ? undefined : true,
    priceLevel: priceLevelFilter !== "all" ? (priceLevelFilter as PriceLevel) : undefined,
    hasBalance: showWithBalance || undefined,
  });
  const deleteMutation = useDeleteCustomer();

  const customers = customersResponse?.data || [];

  // Navigate to create page
  const handleCreate = () => {
    navigate("/customers/new");
  };

  // Navigate to edit page
  const handleEdit = (customer: Customer) => {
    navigate(`/customers/${customer.id}`);
  };

  // Open detail card
  const handleView = (customer: Customer) => {
    setViewCustomer(customer);
  };

  // Open delete confirmation
  const handleDeleteClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDeleteDialogOpen(true);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!selectedCustomer) return;

    try {
      await deleteMutation.mutateAsync(selectedCustomer.id);
      toast.success("تم حذف/إلغاء تفعيل العميل بنجاح");
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.messageAr ||
        error.response?.data?.message ||
        "حدث خطأ أثناء حذف العميل";
      toast.error(errorMsg);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-96" dir="rtl">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">حدث خطأ في تحميل البيانات</p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-4"
              variant="outline"
            >
              إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة العملاء</h1>
          <p className="text-muted-foreground mt-1">
            إدارة بيانات العملاء وحساباتهم المالية
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          عميل جديد
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم، الهاتف، أو رقم العميل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={priceLevelFilter} onValueChange={setPriceLevelFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="مستوى السعر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="standard">عادي</SelectItem>
                <SelectItem value="wholesale">جملة</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="showInactive"
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                />
                <Label htmlFor="showInactive">غير النشطين</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="showWithBalance"
                  checked={showWithBalance}
                  onCheckedChange={setShowWithBalance}
                />
                <Label htmlFor="showWithBalance">لديه رصيد</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            العملاء ({customers.length})
          </CardTitle>
          <CardDescription>جميع العملاء وبياناتهم المالية</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لا يوجد عملاء مطابقون للبحث</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم العميل</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-center">مستوى السعر</TableHead>
                  <TableHead className="text-center">الحد الائتماني</TableHead>
                  <TableHead className="text-center">الرصيد الحالي</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-center">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEdit(customer)}
                  >
                    <TableCell className="font-mono text-sm">
                      {customer.customerNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        {customer.nameEn && (
                          <p className="text-sm text-muted-foreground">
                            {customer.nameEn}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.phone ? (
                        <div className="flex items-center gap-1 text-sm" dir="ltr">
                          <Phone className="w-3 h-3" />
                          {customer.phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.address ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[150px]">{customer.address}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priceLevelColors[customer.priceLevel]}`}>
                        {customer.priceLevel === "vip" && <Crown className="w-3 h-3" />}
                        {customer.priceLevel === "wholesale" && <ShoppingBag className="w-3 h-3" />}
                        {priceLevelLabels[customer.priceLevel]}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {customer.creditLimit > 0 ? (
                        <div className="flex items-center justify-center gap-1 text-sm">
                          <CreditCard className="w-3 h-3 text-blue-500" />
                          {formatAmount(customer.creditLimit)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">غير محدد</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {customer.currentBalance > 0 ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-600">
                          <AlertTriangle className="w-3 h-3" />
                          {formatAmount(customer.currentBalance)}
                        </span>
                      ) : (
                        <Badge variant="outline" className="border-green-200 text-green-600 text-xs">
                          لا يوجد
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.isActive ? "default" : "secondary"}>
                        {customer.isActive ? "نشط" : "غير نشط"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => handleView(customer)}
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(customer)}
                          title="تعديل"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDeleteClick(customer)}
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {customersResponse?.meta && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            عرض {customers.length} من {customersResponse.meta.totalItems} عميل
          </p>
        </div>
      )}

      {/* Customer Detail Card */}
      {viewCustomer && (
        <CustomerDetailCard
          customer={viewCustomer}
          onClose={() => setViewCustomer(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العميل</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف العميل "{selectedCustomer?.name}"؟
              <br />
              {selectedCustomer?.currentBalance && selectedCustomer.currentBalance > 0 ? (
                <span className="text-red-500 font-medium">
                  ⚠️ هذا العميل لديه رصيد مستحق: {formatAmount(selectedCustomer.currentBalance)}
                </span>
              ) : (
                "إذا كان لديه مبيعات سابقة، سيتم إلغاء تفعيله فقط."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "حذف"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
