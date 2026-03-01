import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Plus, Download, Eye, PackageCheck, Loader2, Package, CreditCard, Receipt, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { DocumentStatusBadge } from "@/components/posting";
import { usePurchases, usePurchase } from "@/hooks/use-purchases";
import { Purchase } from "@/types/purchases";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { downloadReportPdf } from "@/services/pdf.service";
import { reconciliationService } from "@/services/reconciliation.service";
import { creditNoteService } from "@/services/credit-note.service";
import { CreditNoteCreateDialog } from "@/components/credit-note/CreditNoteCreateDialog";


function formatCurrency(minorUnits: number): string {
  return `₪ ${(minorUnits / 100).toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function getStatusBadge(status: string) {
  const map: Record<string, { type: "success" | "warning" | "danger" | "info" | "default"; label: string }> = {
    received: { type: "success", label: "تم الاستلام" },
    partial: { type: "warning", label: "استلام جزئي" },
    ordered: { type: "info", label: "تم الطلب" },
    draft: { type: "default", label: "مسودة" },
    cancelled: { type: "danger", label: "ملغي" },
  };
  const entry = map[status] || { type: "default" as const, label: status };
  return <StatusBadge status={entry.type}>{entry.label}</StatusBadge>;
}

function getPaymentBadge(status: string) {
  const map: Record<string, { type: "success" | "warning" | "danger"; label: string }> = {
    paid: { type: "success", label: "مدفوع" },
    partial: { type: "warning", label: "جزئي" },
    unpaid: { type: "danger", label: "غير مدفوع" },
  };
  const entry = map[status] || { type: "danger" as const, label: status };
  return <StatusBadge status={entry.type}>{entry.label}</StatusBadge>;
}

// ─── Detail Card ──────────────────────────────────────────

function PurchaseDetailCard({ purchaseId, open, onClose }: { purchaseId: number; open: boolean; onClose: () => void }) {
  const { data: purchase, isLoading } = usePurchase(purchaseId);
  const [showCreditNoteDialog, setShowCreditNoteDialog] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadOrderPdf = async () => {
    setPdfLoading(true);
    try {
      await downloadReportPdf("purchase-order", { id: purchaseId, language: "ar" });
      toast({ title: "تم التحميل", description: "تم تحميل أمر الشراء بنجاح" });
    } catch {
      toast({ variant: "destructive", title: "فشل التحميل", description: "تعذر تحميل ملف PDF" });
    } finally {
      setPdfLoading(false);
    }
  };

  const { data: outstandingData } = useQuery({
    queryKey: ["reconciliation", "outstanding", "purchase", purchaseId],
    queryFn: async () => {
      const r = await reconciliationService.getPurchaseOutstanding(purchaseId);
      const val = r.data?.data ?? r.data;
      return typeof val === "number" ? val : 0;
    },
    enabled: open && !!purchaseId,
  });

  const { data: creditNotesData } = useQuery({
    queryKey: ["credit-notes", "invoice", "purchase", purchaseId],
    queryFn: async () => {
      const r = await creditNoteService.getAll({
        originalInvoiceType: "purchase",
        originalInvoiceId: purchaseId,
        pageSize: 50,
      });
      return r.data?.data ?? r.data;
    },
    enabled: open && !!purchaseId,
  });

  const outstanding = outstandingData ?? (purchase?.amountDue ?? 0);
  const linkedCreditNotes = creditNotesData?.items ?? [];
  const canCreateCreditNote = purchase && purchase.status !== "cancelled" && outstanding > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 flex-row-reverse">
            <DialogTitle className="text-xl font-bold flex items-center gap-3 flex-row-reverse">
              تفاصيل أمر الشراء {purchase?.purchaseNumber || ""}
              <DocumentStatusBadge
                docstatus={purchase?.docstatus}
                isVoided={purchase?.status === "cancelled"}
                isApproved={purchase?.status === "received" || purchase?.status === "partial" || purchase?.status === "ordered"}
              />
            </DialogTitle>
            {purchase && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 shrink-0"
                onClick={handleDownloadOrderPdf}
                disabled={pdfLoading}
              >
                {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                تحميل PDF
              </Button>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : purchase ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InfoItem label="رقم الطلب" value={purchase.purchaseNumber} />
              <InfoItem label="التاريخ" value={formatDate(purchase.purchaseDate)} />
              <InfoItem label="التاجر" value={purchase.supplierName} />
              <InfoItem label="حالة المستند" value={
                <DocumentStatusBadge
                  docstatus={purchase.docstatus}
                  isVoided={purchase.status === "cancelled"}
                  isApproved={purchase.status === "received" || purchase.status === "partial" || purchase.status === "ordered"}
                />
              } />
              <InfoItem label="حالة الطلب" value={getStatusBadge(purchase.status)} />
              <InfoItem label="حالة الدفع" value={getPaymentBadge(purchase.paymentStatus)} />
              {purchase.dueDate && <InfoItem label="تاريخ الاستحقاق" value={formatDate(purchase.dueDate)} />}
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground">المبالغ</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <InfoItem label="المبلغ الإجمالي" value={formatCurrency(purchase.totalAmount)} />
                <InfoItem label="الضريبة" value={formatCurrency(purchase.taxAmount)} />
                <InfoItem label="الإجمالي الكلي" value={formatCurrency(purchase.grandTotal)} highlight />
                <InfoItem label="المدفوع" value={formatCurrency(purchase.amountPaid)} success />
                <InfoItem label="المتبقي" value={formatCurrency(purchase.amountDue)} danger={purchase.amountDue > 0} />
                <InfoItem label="المستحق (من PLE)" value={formatCurrency(outstanding)} highlight />
              </div>
              {canCreateCreditNote && (
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={() => setShowCreditNoteDialog(true)}>
                    <Receipt className="w-4 h-4 ml-2" />
                    إنشاء رصيد دائن
                  </Button>
                </div>
              )}
            </div>

            {linkedCreditNotes.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-sm text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" /> الإشعارات الدائنة ({linkedCreditNotes.length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الرقم</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedCreditNotes.map((cn: { id: number; creditNoteNumber: string; creditNoteDate: string; amount: number; docstatus: number }) => (
                        <TableRow key={cn.id}>
                          <TableCell>{cn.creditNoteNumber}</TableCell>
                          <TableCell>{formatDate(cn.creditNoteDate)}</TableCell>
                          <TableCell>{formatCurrency(cn.amount)}</TableCell>
                          <TableCell>{cn.docstatus === 1 ? "مُرحّل" : "مسودة"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <CreditNoteCreateDialog
              open={showCreditNoteDialog}
              onClose={() => setShowCreditNoteDialog(false)}
              originalInvoiceType="purchase"
              originalInvoiceId={purchaseId}
            />

            {purchase.purchaseLines && purchase.purchaseLines.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-sm text-muted-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" /> الأصناف ({purchase.purchaseLines.length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right">الصنف</TableHead>
                        <TableHead className="text-center">الوزن المطلوب (كجم)</TableHead>
                        <TableHead className="text-center">المستلم (كجم)</TableHead>
                        <TableHead className="text-center">السعر/كجم</TableHead>
                        <TableHead className="text-center">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchase.purchaseLines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <span className="font-medium">{line.itemName}</span>
                            <span className="text-xs text-muted-foreground mr-2">{line.itemCode}</span>
                            {line.isLiveBird && <span className="text-xs bg-orange-100 dark:bg-orange-950 text-orange-600 px-1 rounded mr-1">حي</span>}
                          </TableCell>
                          <TableCell className="text-center font-english" dir="ltr">{(line.weightGrams / 1000).toFixed(2)}</TableCell>
                          <TableCell className="text-center font-english" dir="ltr">{(line.receivedWeightGrams / 1000).toFixed(2)}</TableCell>
                          <TableCell className="text-center">{formatCurrency(line.pricePerKg)}</TableCell>
                          <TableCell className="text-center font-semibold">{formatCurrency(line.lineTotalAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {purchase.notes && (
              <div>
                <h3 className="font-semibold mb-2 text-sm text-muted-foreground">ملاحظات</h3>
                <p className="text-sm bg-muted/30 rounded-lg p-3">{purchase.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">لم يتم العثور على أمر الشراء</p>
        )}
      </DialogContent>
    </Dialog>
  );
}


function InfoItem({
  label, value, highlight, success, danger,
}: {
  label: string; value: React.ReactNode; highlight?: boolean; success?: boolean; danger?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${highlight ? "text-primary text-base" : ""} ${success ? "text-green-600 dark:text-green-400" : ""} ${danger ? "text-red-600 dark:text-red-400" : ""}`}>
        {value}
      </p>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────

export default function Purchasing() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const navigate = useNavigate();

  const queryParams = {
    page, pageSize,
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  };

  const { data, isLoading, error } = usePurchases(queryParams);
  const purchases = data?.data || [];
  const pagination = data?.pagination;

  const [detailId, setDetailId] = useState<number | null>(null);

  const filteredPurchases = purchases.filter((p: Purchase) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.purchaseNumber.toLowerCase().includes(q) ||
      (p.supplierName || "").includes(searchQuery)
    );
  });

  return (
    <div className="space-y-6">
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

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالتاجر أو رقم الطلب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="حالة الطلب" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="draft">مسودة</SelectItem>
                <SelectItem value="ordered">تم الطلب</SelectItem>
                <SelectItem value="partial">استلام جزئي</SelectItem>
                <SelectItem value="received">تم الاستلام</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="mr-3 text-muted-foreground">جاري التحميل...</span>
            </div>
          ) : error ? (
            <div className="text-center py-16 text-red-500">
              <p>حدث خطأ في تحميل البيانات</p>
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">لا توجد مشتريات</p>
              <p className="text-sm mt-1">ابدأ بإنشاء أمر شراء جديد</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="data-table-header">
                  <TableHead className="text-right">رقم الطلب</TableHead>
                  <TableHead className="text-right">التاجر</TableHead>
                  <TableHead className="text-center">التاريخ</TableHead>
                  <TableHead className="text-center">الإجمالي</TableHead>
                  <TableHead className="text-center">المدفوع</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead className="text-center">الدفع</TableHead>
                  <TableHead className="text-center w-20">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map((purchase: Purchase) => (
                  <TableRow key={purchase.id} className="data-table-row">
                    <TableCell className="font-mono text-sm">{purchase.purchaseNumber}</TableCell>
                    <TableCell className="font-medium">{purchase.supplierName}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{formatDate(purchase.purchaseDate)}</TableCell>
                    <TableCell className="text-center font-semibold">{formatCurrency(purchase.grandTotal || purchase.totalAmount)}</TableCell>
                    <TableCell className="text-center text-green-600 dark:text-green-400">{formatCurrency(purchase.amountPaid || 0)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        {getStatusBadge(purchase.status)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        {getPaymentBadge(purchase.paymentStatus)}
                        {(purchase.grandTotal || purchase.totalAmount) - (purchase.amountPaid || 0) > 0 && (
                          <span className="text-[10px] text-red-500 font-english" dir="ltr">
                            -{formatCurrency((purchase.grandTotal || purchase.totalAmount) - (purchase.amountPaid || 0))}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="عرض التفاصيل"
                          onClick={() => setDetailId(purchase.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {purchase.paymentStatus !== "paid" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" title="تسجيل دفعة"
                            onClick={() => navigate(`/payments/new?purchaseId=${purchase.id}`)}>
                            <CreditCard className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pagination
            ? `عرض ${filteredPurchases.length} من ${pagination.totalItems} — صفحة ${pagination.page} من ${pagination.totalPages}`
            : `عرض ${filteredPurchases.length} طلب شراء`}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={!pagination?.hasPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}>السابق</Button>
          <Button variant="outline" size="sm" disabled={!pagination?.hasNext}
            onClick={() => setPage((p) => p + 1)}>التالي</Button>
        </div>
      </div>

      {detailId && (
        <PurchaseDetailCard purchaseId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
