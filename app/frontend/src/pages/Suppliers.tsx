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
  Eye,
  Mail,
  Hash,
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
  Building2,
  Briefcase,
  Star,
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
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  useSuppliers,
  useDeleteSupplier,
} from "@/hooks/use-suppliers";
import { Supplier } from "@/types/supplier";
import { PdfPreviewDialog } from "@/components/reports/PdfPreviewDialog";

/**
 * Format amount from minor units to display
 */
function formatAmount(amount: number): string {
  return (amount / 1000).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

// ----- Supplier Detail Card Component -----
function SupplierDetailCard({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const [showStatementPdf, setShowStatementPdf] = useState(false);
  const n = new Date();
  const pdfParams = {
    id: supplier.id,
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
                <Building2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{supplier.name}</h2>
                {supplier.nameEn && (
                  <p className="text-emerald-100 text-sm mt-0.5">{supplier.nameEn}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 font-mono text-xs backdrop-blur-sm">
                    {supplier.supplierNumber}
                  </Badge>
                  <Badge className={`border-0 text-xs backdrop-blur-sm ${supplier.isActive
                    ? "bg-emerald-400/20 text-emerald-100"
                    : "bg-red-400/20 text-red-100"
                    }`}>
                    {supplier.isActive ? (
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> نشط</span>
                    ) : (
                      <span className="flex items-center gap-1"><XCircle className="w-3 h-3" /> غير نشط</span>
                    )}
                  </Badge>
                  {supplier.rating && (
                    <div className="flex items-center gap-0.5 bg-amber-400/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                      <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
                      <span className="text-xs font-bold text-amber-100">{supplier.rating}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary Strip */}
        <div className="grid grid-cols-2 -mt-4 mx-4 gap-4">
          <div className="bg-white rounded-xl shadow-md border border-slate-100 p-3 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">المستحقات الحالية</p>
            <p className={`text-lg font-bold ${supplier.currentBalance > 0 ? "text-amber-600" : "text-green-600"}`}>
              {supplier.currentBalance > 0 ? formatAmount(supplier.currentBalance) : "0.000"}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-slate-100 p-3 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">شروط الدفع</p>
            <p className="text-sm font-bold text-slate-700 truncate px-2">
              {supplier.paymentTerms || "غير محدد"}
            </p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 pt-4 space-y-4 max-h-[55dvh] overflow-y-auto">
          {/* Contact Information */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" />
              معلومات الاتصال
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailItem
                icon={<Briefcase className="w-4 h-4 text-emerald-500" />}
                label="الشخص المسؤول"
                value={supplier.contactPerson}
              />
              <DetailItem
                icon={<Phone className="w-4 h-4 text-teal-500" />}
                label="الهاتف"
                value={supplier.phone}
                dir="ltr"
              />
              <DetailItem
                icon={<Mail className="w-4 h-4 text-cyan-500" />}
                label="البريد الإلكتروني"
                value={supplier.email}
                dir="ltr"
              />
              <DetailItem
                icon={<MapPin className="w-4 h-4 text-rose-500" />}
                label="العنوان"
                value={supplier.address}
              />
            </div>
          </div>

          <Separator />

          {/* Financial & Bank Details */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5" />
              المعلومات البنكية والمالية
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailItem
                icon={<Hash className="w-4 h-4 text-emerald-500" />}
                label="الرقم الضريبي"
                value={supplier.taxNumber}
                mono
              />
              <DetailItem
                icon={<CreditCard className="w-4 h-4 text-blue-500" />}
                label="الحد الائتماني"
                value={supplier.creditLimit ? formatAmount(supplier.creditLimit) : "غير محدد"}
              />
              <DetailItem
                icon={<Building2 className="w-4 h-4 text-indigo-500" />}
                label="اسم البنك"
                value={supplier.bankName}
              />
              <DetailItem
                icon={<Hash className="w-4 h-4 text-slate-500" />}
                label="رقم الحساب البنكي"
                value={supplier.bankAccountNumber}
                mono
              />
            </div>
          </div>

          {/* Notes */}
          {supplier.notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  ملاحظات
                </h3>
                <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4 border border-slate-100 leading-relaxed">
                  {supplier.notes}
                </p>
              </div>
            </>
          )}

          <Separator />

          {/* System Info */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              معلومات النظام
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailItem
                icon={<Calendar className="w-4 h-4 text-slate-400" />}
                label="تاريخ الإنشاء"
                value={new Date(supplier.createdAt).toLocaleString("ar-EG", {
                  year: "numeric", month: "long", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              />
              <DetailItem
                icon={<Calendar className="w-4 h-4 text-slate-400" />}
                label="آخر تحديث"
                value={new Date(supplier.updatedAt).toLocaleString("ar-EG", {
                  year: "numeric", month: "long", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
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
        reportType="supplier-statement"
        params={pdfParams}
        title={`كشف حساب المورد — ${supplier.name}`}
      />
    )}
    </>
  );
}

function DetailItem({ icon, label, value, dir, mono }: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  dir?: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p
        className={`text-sm text-slate-700 ${mono ? "font-mono" : ""} ${!value ? "text-slate-300 italic" : ""}`}
        dir={dir}
      >
        {value || "غير محدد"}
      </p>
    </div>
  );
}

// ----- Main Suppliers Page -----
export default function Suppliers() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);

  // Query with filters
  const { data: suppliersResponse, isLoading, error } = useSuppliers({
    search: searchQuery || undefined,
  });
  const deleteMutation = useDeleteSupplier();

  const suppliers = suppliersResponse?.data || [];

  // Navigate to create page
  const handleCreate = () => {
    navigate("/traders/new");
  };

  // Navigate to edit page
  const handleEdit = (supplier: Supplier) => {
    navigate(`/traders/${supplier.id}`);
  };

  // Open detail card
  const handleView = (supplier: Supplier) => {
    setViewSupplier(supplier);
  };

  // Open delete confirmation
  const handleDeleteClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDeleteDialogOpen(true);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!selectedSupplier) return;

    try {
      await deleteMutation.mutateAsync(selectedSupplier.id);
      toast.success("تم حذف المورد بنجاح");
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.messageAr ||
        error.response?.data?.message ||
        "حدث خطأ أثناء حذف المورد";
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
          <h1 className="text-2xl font-bold text-foreground">التجار والموردون</h1>
          <p className="text-muted-foreground mt-1">
            إدارة بيانات الموردين، مزارع الدواجن، وتتبع المستحقات المالية
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            تصدير
          </Button>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            تاجر جديد
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم، الهاتف، أو رقم المورد..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Briefcase className="w-5 h-5" />
            الموردون ({suppliers.length})
          </CardTitle>
          <CardDescription>عرض جميع الموردين المسجلين في النظام</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لا يوجد موردون مطابقون للبحث</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم المورد</TableHead>
                  <TableHead className="text-right">اسم التاجر/المورد</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">المسؤول</TableHead>
                  <TableHead className="text-right">شروط الدفع</TableHead>
                  <TableHead className="text-center">المستحقات</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-center">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow
                    key={supplier.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleEdit(supplier)}
                  >
                    <TableCell className="font-mono text-sm text-slate-500">
                      {supplier.supplierNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-bold text-slate-700">{supplier.name}</p>
                        {supplier.nameEn && (
                          <p className="text-xs text-muted-foreground font-english" dir="ltr">
                            {supplier.nameEn}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {supplier.phone ? (
                        <div className="flex items-center gap-1 text-sm font-english" dir="ltr">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {supplier.phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {supplier.contactPerson || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {supplier.paymentTerms || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-center text-sm font-bold">
                      {supplier.currentBalance > 0 ? (
                        <span className="text-amber-600">₪ {formatAmount(supplier.currentBalance)}</span>
                      ) : (
                        <span className="text-emerald-500">لا يوجد</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={supplier.isActive ? "default" : "secondary"} className={supplier.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100" : ""}>
                        {supplier.isActive ? "نشط" : "غير نشط"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => handleView(supplier)}
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-600 hover:bg-slate-50"
                          onClick={() => handleEdit(supplier)}
                          title="تعديل"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => handleDeleteClick(supplier)}
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Pagination Summary */}
      {suppliersResponse?.meta && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            عرض {suppliers.length} من {suppliersResponse.meta.totalItems} تاجر
          </p>
        </div>
      )}

      {/* Supplier Detail Card */}
      {viewSupplier && (
        <SupplierDetailCard
          supplier={viewSupplier}
          onClose={() => setViewSupplier(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المورد</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المورد "{selectedSupplier?.name}"؟
              <br />
              {selectedSupplier?.currentBalance && selectedSupplier.currentBalance > 0 ? (
                <span className="text-amber-600 font-medium">
                  ⚠️ هذا المورد لديه مستحقات مالية قائمة: ₪ {formatAmount(selectedSupplier.currentBalance)}
                </span>
              ) : (
                "سيتم حذف المورد من النظام نهائياً إذا لم يكن لديه حركات شراء سابقة."
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
