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
  Download,
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
import { PdfPreviewDialog } from "@/components/reports/PdfPreviewDialog";

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
  return (amount / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ----- Customer Detail Card Component -----
function CustomerDetailCard({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [showStatementPdf, setShowStatementPdf] = useState(false);
  const n = new Date();
  const pdfParams = {
    id: customer.id,
    startDate: new Date(n.getFullYear(), 0, 1).toISOString().slice(0, 10),
    endDate: n.toISOString().slice(0, 10),
    language: 'ar' as const,
  };
  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent
          className="max-w-2xl p-0 overflow-hidden border-0 rounded-2xl shadow-2xl"
          dir="rtl"
        >
          {/* Header with gradient */}
          <div className="relative bg-gradient-to-l from-emerald-600 via-teal-600 to-cyan-700 p-6 pb-8">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cdefs%3E%3Cpattern%20id%3D%22a%22%20patternUnits%3D%22userSpaceOnUse%22%20width%3D%2220%22%20height%3D%2220%22%3E%3Ccircle%20cx%3D%2210%22%20cy%3D%2210%22%20r%3D%221%22%20fill%3D%22rgba(255%2C255%2C255%2C0.08)%22%2F%3E%3C%2Fpattern%3E%3C%2Fdefs%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22url(%23a)%22%2F%3E%3C%2Fsvg%3E')] opacity-50" />
            <div className="relative flex items-start justify-between">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 gap-2 shrink-0"
                onClick={() => setShowStatementPdf(true)}
              >
                <Download className="w-4 h-4" />
                كشف حساب PDF
              </Button>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{customer.name}</h2>
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
                {customer.defaultDiscountPct > 0 ? `₪${(customer.defaultDiscountPct / 100).toFixed(2)}` : "₪0.00"}
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-6 pt-6 space-y-6 max-h-[50dvh] overflow-y-auto custom-scrollbar">
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
                  label="خصم افتراضي"
                  value={customer.defaultDiscountPct > 0 ? `₪${(customer.defaultDiscountPct / 100).toFixed(2)}` : null}
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
                  value={new Date(customer.createdAt).toLocaleString("en-US")}
                />
                <DetailItem
                  icon={<Calendar className="w-4 h-4 text-slate-400" />}
                  label="آخر تحديث"
                  value={new Date(customer.updatedAt).toLocaleString("en-US")}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {showStatementPdf && (
        <PdfPreviewDialog
          open={showStatementPdf}
          onOpenChange={setShowStatementPdf}
          reportType="customer-statement"
          params={pdfParams}
          title={`كشف حساب الزبون — ${customer.name}`}
        />
      )}
    </>
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
    isActive: showInactive ? false : undefined,
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
    <div className="space-y-5" dir="rtl">

      {/* ── Page Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-teal-600 via-cyan-600 to-emerald-600 p-6">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2230%22%20height%3D%2230%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cdefs%3E%3Cpattern%20id%3D%22g%22%20patternUnits%3D%22userSpaceOnUse%22%20width%3D%2230%22%20height%3D%2230%22%3E%3Ccircle%20cx%3D%2215%22%20cy%3D%2215%22%20r%3D%221.2%22%20fill%3D%22rgba(255%2C255%2C255%2C0.1)%22%2F%3E%3C%2Fpattern%3E%3C%2Fdefs%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22url(%23g)%22%2F%3E%3C%2Fsvg%3E')] opacity-60" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/25 shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">إدارة الزبائن</h1>
              <p className="text-sm text-white/70 mt-0.5">إدارة بيانات الزبائن وحساباتهم المالية</p>
            </div>
          </div>
          <Button
            onClick={handleCreate}
            className="gap-2 bg-white text-teal-700 hover:bg-white/90 font-bold shadow-md"
          >
            <Plus className="w-4 h-4" /> زبون جديد
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      {!isLoading && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">إجمالي الزبائن</p>
              <p className="text-2xl font-bold leading-tight">{customers.length}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">VIP</p>
              <p className="text-2xl font-bold leading-tight text-amber-600">{customers.filter(c => c.priceLevel === 'vip').length}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">جملة</p>
              <p className="text-2xl font-bold leading-tight text-blue-600">{customers.filter(c => c.priceLevel === 'wholesale').length}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">لديهم رصيد</p>
              <p className="text-2xl font-bold leading-tight text-rose-600">{customers.filter(c => c.currentBalance > 0).length}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-slate-700 p-3 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="بحث بالاسم، الهاتف، أو رقم الزبون..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 h-9 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 transition-colors"
          />
        </div>
        <div className="w-px h-7 bg-slate-200 dark:bg-slate-600 shrink-0" />
        <Select value={priceLevelFilter} onValueChange={setPriceLevelFilter}>
          <SelectTrigger className="w-[145px] h-9 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800">
            <SelectValue placeholder="مستوى السعر" />
          </SelectTrigger>
          <SelectContent dir="rtl">
            <SelectItem value="all">جميع المستويات</SelectItem>
            <SelectItem value="standard">عادي</SelectItem>
            <SelectItem value="wholesale">جملة</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`h-9 px-3 rounded-lg border text-sm font-medium transition-all ${
            showInactive
              ? "bg-slate-700 text-white border-slate-700"
              : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-muted-foreground hover:border-slate-400 hover:bg-white dark:hover:bg-slate-700"
          }`}
        >
          غير النشطين
        </button>
        <button
          onClick={() => setShowWithBalance(!showWithBalance)}
          className={`h-9 px-3 rounded-lg border text-sm font-medium transition-all ${
            showWithBalance
              ? "bg-rose-600 text-white border-rose-600"
              : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-muted-foreground hover:border-slate-400 hover:bg-white dark:hover:bg-slate-700"
          }`}
        >
          لديهم رصيد
        </button>
      </div>

      {/* ── Table ── */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {customers.length} زبون مسجّل
          </span>
          {customersResponse?.meta && (
            <span className="text-xs text-muted-foreground bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2.5 py-1 rounded-full">
              عرض {customers.length} من {customersResponse.meta.totalItems}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-52 gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
            <span className="text-sm">جاري تحميل البيانات...</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 opacity-30" />
            </div>
            <p className="text-sm font-semibold">لا يوجد زبائن مطابقون للبحث</p>
            <p className="text-xs mt-1 opacity-60">جرّب تغيير معايير البحث</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-700">
                <TableHead className="text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[110px] pr-5">رقم الزبون</TableHead>
                <TableHead className="text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">الاسم</TableHead>
                <TableHead className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">الهاتف</TableHead>
                <TableHead className="text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider">العنوان</TableHead>
                <TableHead className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">المستوى</TableHead>
                <TableHead className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">الحد الائتماني</TableHead>
                <TableHead className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">الرصيد</TableHead>
                <TableHead className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[80px]">الحالة</TableHead>
                <TableHead className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[100px]">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer hover:bg-teal-50/40 dark:hover:bg-teal-900/10 group border-slate-50 dark:border-slate-700/50 transition-colors"
                  onClick={() => handleEdit(customer)}
                >
                  <TableCell className="font-mono text-xs text-slate-400 py-3.5 pr-5">
                    {customer.customerNumber}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${
                        customer.priceLevel === 'vip'
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                          : customer.priceLevel === 'wholesale'
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                          : "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400"
                      }`}>
                        {customer.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-sm">{customer.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5 text-center">
                    {customer.phone ? (
                      <div className="inline-flex items-center justify-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span dir="ltr">{customer.phone}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5">
                    {customer.address ? (
                      <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[120px]">{customer.address}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${priceLevelColors[customer.priceLevel]}`}>
                      {customer.priceLevel === "vip" && <Crown className="w-3 h-3" />}
                      {customer.priceLevel === "wholesale" && <ShoppingBag className="w-3 h-3" />}
                      {priceLevelLabels[customer.priceLevel]}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 text-center">
                    {customer.creditLimit > 0 ? (
                      <div className="flex items-center justify-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                        <CreditCard className="w-3 h-3 text-slate-400" />
                        {formatAmount(customer.creditLimit)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5 text-center">
                    {customer.currentBalance > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800">
                        <AlertTriangle className="w-3 h-3" />
                        {formatAmount(customer.currentBalance)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> مسدّد
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      customer.isActive
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-500 border border-slate-200 dark:border-slate-600"
                    }`}>
                      {customer.isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {customer.isActive ? "نشط" : "موقوف"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        onClick={() => handleView(customer)}
                        title="عرض التفاصيل"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                        onClick={() => handleEdit(customer)}
                        title="تعديل"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                        onClick={() => handleDeleteClick(customer)}
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

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
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              حذف العميل
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف العميل <strong>"{selectedCustomer?.name}"</strong>؟
              <br />
              {selectedCustomer?.currentBalance && selectedCustomer.currentBalance > 0 ? (
                <span className="text-rose-600 font-medium mt-2 block">
                  ⚠️ هذا العميل لديه رصيد مستحق: {formatAmount(selectedCustomer.currentBalance)}
                </span>
              ) : (
                <span className="mt-2 block">إذا كان لديه مبيعات سابقة، سيتم إلغاء تفعيله فقط.</span>
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
