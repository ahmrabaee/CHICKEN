import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Download, Eye, Ban, CreditCard, Printer, Loader2, Package, Receipt, FileText } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { DocumentStatusBadge } from "@/components/posting";
import { useNavigate } from "react-router-dom";
import { useSales, useSale, useVoidSale } from "@/hooks/use-sales";
import { useQuery } from "@tanstack/react-query";
import { reconciliationService } from "@/services/reconciliation.service";
import { creditNoteService } from "@/services/credit-note.service";
import { CreditNoteCreateDialog } from "@/components/credit-note/CreditNoteCreateDialog";
import { Sale } from "@/types/sales";
import { toast } from "@/hooks/use-toast";
import { downloadReportPdf } from "@/services/pdf.service";

/** Format minor units (fils/cents) to display currency */
function formatCurrency(minorUnits: number): string {
  return `₪ ${(minorUnits / 100).toFixed(2)}`;
}

/** Format date string to Arabic-friendly display */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Map backend payment status to UI badge */
function getPaymentStatusBadge(status: string, isVoided: boolean) {
  if (isVoided) return <StatusBadge status="danger">ملغية</StatusBadge>;
  const map: Record<string, { type: "success" | "warning" | "danger" | "info"; label: string }> = {
    paid: { type: "success", label: "مدفوع" },
    partial: { type: "warning", label: "مدفوع جزئياً" },
    unpaid: { type: "danger", label: "غير مدفوع" },
  };
  const entry = map[status] || { type: "info" as const, label: status };
  return <StatusBadge status={entry.type}>{entry.label}</StatusBadge>;
}

/** Map sale type to Arabic label */
function getSaleTypeLabel(saleType: string) {
  const map: Record<string, string> = { cash: "نقدي", credit: "آجل", mixed: "مختلط" };
  return map[saleType] || saleType;
}

/** Map payment method to Arabic label */
function getPaymentMethodLabel(method: string) {
  const map: Record<string, string> = {
    cash: "نقدي", card: "بطاقة", bank_transfer: "تحويل بنكي", mobile: "دفع إلكتروني", check: "شيك",
  };
  return map[method] || method;
}

// ─── Detail Card Component ────────────────────────────────────

function SaleDetailCard({ saleId, open, onClose }: { saleId: number; open: boolean; onClose: () => void }) {
  const { data: sale, isLoading } = useSale(saleId);
  const [showCreditNoteDialog, setShowCreditNoteDialog] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadInvoicePdf = async () => {
    setPdfLoading(true);
    try {
      await downloadReportPdf("sale-invoice", { id: saleId, language: "ar" });
      toast({ title: "تم التحميل", description: "تم تحميل فاتورة المبيعات بنجاح" });
    } catch {
      toast({ variant: "destructive", title: "فشل التحميل", description: "تعذر تحميل ملف PDF" });
    } finally {
      setPdfLoading(false);
    }
  };

  const { data: outstandingData } = useQuery({
    queryKey: ["reconciliation", "outstanding", "sale", saleId],
    queryFn: async () => {
      const r = await reconciliationService.getSaleOutstanding(saleId);
      const val = r.data?.data ?? r.data;
      return typeof val === "number" ? val : 0;
    },
    enabled: open && !!saleId,
  });

  const { data: creditNotesData } = useQuery({
    queryKey: ["credit-notes", "invoice", "sale", saleId],
    queryFn: async () => {
      const r = await creditNoteService.getAll({
        originalInvoiceType: "sale",
        originalInvoiceId: saleId,
        pageSize: 50,
      });
      return r.data?.data ?? r.data;
    },
    enabled: open && !!saleId,
  });

  const outstanding = outstandingData ?? (sale ? sale.totalAmount - sale.amountPaid : 0);
  const linkedCreditNotes = creditNotesData?.items ?? [];

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 flex-row-reverse">
            <DialogTitle className="text-xl font-bold flex items-center gap-3 flex-row-reverse">
              تفاصيل الفاتورة {sale?.saleNumber || ""}
              {(sale?.docstatus !== undefined || sale?.isVoided !== undefined) && (
                <DocumentStatusBadge
                  docstatus={(sale as any).docstatus ?? (sale.isVoided ? 2 : 1)}
                  isVoided={sale.isVoided}
                />
              )}
            </DialogTitle>
            {sale && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 shrink-0"
                onClick={handleDownloadInvoicePdf}
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
        ) : sale ? (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InfoItem label="رقم الفاتورة" value={sale.saleNumber} />
              <InfoItem label="التاريخ" value={formatDate(sale.saleDate)} />
              <InfoItem label="نوع البيع" value={getSaleTypeLabel(sale.saleType)} />
              <InfoItem label="الزبون" value={sale.customerName || "زبون عادي"} />
              {sale.customerPhone && <InfoItem label="هاتف الزبون" value={sale.customerPhone} ltr />}
              <InfoItem label="حالة المستند" value={
                <DocumentStatusBadge docstatus={(sale as any).docstatus ?? (sale.isVoided ? 2 : 1)} isVoided={sale.isVoided} />
              } />
              <InfoItem label="حالة الدفع" value={
                <span>{getPaymentStatusBadge(sale.paymentStatus, sale.isVoided)}</span>
              } />
            </div>

            {/* Amounts */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground">المبالغ</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <InfoItem label="الإجمالي الخام" value={formatCurrency(sale.grossTotalAmount)} />
                <InfoItem label="الخصم" value={formatCurrency(sale.discountAmount)} />
                <InfoItem label="الضريبة" value={formatCurrency(sale.taxAmount)} />
                <InfoItem label="الإجمالي الصافي" value={formatCurrency(sale.totalAmount)} highlight />
                <InfoItem label="المدفوع" value={formatCurrency(sale.amountPaid)} success />
                <InfoItem label="المتبقي" value={formatCurrency((sale.amountDue ?? sale.totalAmount - sale.amountPaid))} danger={sale.totalAmount - sale.amountPaid > 0} />
                <InfoItem label="المستحق (من PLE)" value={formatCurrency(outstanding)} highlight />
              </div>
              {!sale.isVoided && outstanding > 0 && (
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={() => setShowCreditNoteDialog(true)}>
                    <Receipt className="w-4 h-4 ml-2" />
                    إنشاء رصيد دائن
                  </Button>
                </div>
              )}
            </div>

            {/* Linked Credit Notes */}
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
              onSuccess={() => { /* queries invalidated in dialog */ }}
              originalInvoiceType="sale"
              originalInvoiceId={saleId}
            />

            {/* Cost & Profit (Admin) */}
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-sm text-blue-600 dark:text-blue-400">التكلفة والربح</h3>
              <div className="grid grid-cols-3 gap-3">
                <InfoItem label="إجمالي التكلفة" value={formatCurrency(sale.totalCost)} />
                <InfoItem label="إجمالي الربح" value={formatCurrency(sale.totalProfit)} />
                <InfoItem label="نسبة الربح" value={sale.totalAmount > 0 ? `${((sale.totalProfit / sale.totalAmount) * 100).toFixed(1)}%` : "0%"} />
              </div>
            </div>

            {/* Sale Lines */}
            {sale.saleLines && sale.saleLines.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-sm text-muted-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" /> الأصناف ({sale.saleLines.length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right">الصنف</TableHead>
                        <TableHead className="text-center">الوزن (كجم)</TableHead>
                        <TableHead className="text-center">السعر/كجم</TableHead>
                        <TableHead className="text-center">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sale.saleLines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div>
                              <span className="font-medium">{line.itemName}</span>
                              <span className="text-xs text-muted-foreground mr-2">{line.itemCode}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-english" dir="ltr">
                            {(line.weightGrams / 1000).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">{formatCurrency(line.pricePerKg)}</TableCell>
                          <TableCell className="text-center font-semibold">{formatCurrency(line.lineTotalAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Payments */}
            {sale.payments && sale.payments.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-sm text-muted-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> الدفعات ({sale.payments.length})
                </h3>
                <div className="space-y-2">
                  {sale.payments.map((payment: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <span className="font-medium">{formatCurrency(payment.amount)}</span>
                        <span className="text-sm text-muted-foreground mr-2">
                          ({getPaymentMethodLabel(payment.paymentMethod || payment.payment_method)})
                        </span>
                      </div>
                      {payment.paymentDate && (
                        <span className="text-sm text-muted-foreground">{formatDate(payment.paymentDate)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Void Info */}
            {sale.isVoided && (
              <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-sm text-red-600 dark:text-red-400">معلومات الإلغاء</h3>
                {sale.voidReason && <p className="text-sm">{sale.voidReason}</p>}
                {sale.voidedAt && <p className="text-xs text-muted-foreground mt-1">{formatDate(sale.voidedAt)}</p>}
              </div>
            )}

            {/* Notes */}
            {sale.notes && (
              <div>
                <h3 className="font-semibold mb-2 text-sm text-muted-foreground">ملاحظات</h3>
                <p className="text-sm bg-muted/30 rounded-lg p-3">{sale.notes}</p>
              </div>
            )}

            {/* Due date */}
            {sale.dueDate && (
              <InfoItem label="تاريخ الاستحقاق" value={formatDate(sale.dueDate)} />
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">لم يتم العثور على الفاتورة</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Reusable info display item */
function InfoItem({
  label,
  value,
  highlight,
  success,
  danger,
  ltr,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  success?: boolean;
  danger?: boolean;
  ltr?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p
        className={`text-sm font-medium ${highlight ? "text-primary text-base" : ""} ${success ? "text-green-600 dark:text-green-400" : ""} ${danger ? "text-red-600 dark:text-red-400" : ""}`}
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </p>
    </div>
  );
}


// ─── Void Confirmation Dialog ─────────────────────────────────

function VoidSaleDialog({
  saleId,
  open,
  onClose,
}: {
  saleId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const voidSale = useVoidSale();

  const handleSubmit = () => {
    if (!reason.trim()) {
      toast({ variant: "destructive", title: "يرجى إدخال سبب الإلغاء" });
      return;
    }
    voidSale.mutate(
      { id: saleId, data: { reason } },
      {
        onSuccess: () => {
          onClose();
          setReason("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-red-600">إلغاء الفاتورة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد من إلغاء هذه الفاتورة؟ هذا الإجراء لا يمكن التراجع عنه.
          </p>
          <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
            سيتم إنشاء قيد عكسي محاسبي وتراجع المخزون.
          </p>
          <div>
            <label className="text-sm font-medium">سبب الإلغاء</label>
            <Input
              placeholder="أدخل سبب الإلغاء..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">إلغاء</Button>
            <Button variant="destructive" onClick={handleSubmit} className="flex-1" disabled={voidSale.isPending}>
              {voidSale.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              تأكيد الإلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Sales Page ──────────────────────────────────────────

export default function Sales() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Build query params
  const queryParams = {
    page,
    pageSize,
    ...(statusFilter !== "all" ? { paymentStatus: statusFilter } : {}),
  };

  const { data, isLoading, error } = useSales(queryParams);
  const sales = data?.data || [];
  const pagination = data?.pagination;

  // Detail card state
  const [detailSaleId, setDetailSaleId] = useState<number | null>(null);
  // Void dialog state
  const [voidSaleId, setVoidSaleId] = useState<number | null>(null);

  // Client-side search filter (on top of server-side filters)
  const filteredSales = sales.filter((sale: Sale) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      sale.saleNumber.toLowerCase().includes(q) ||
      (sale.customerName || "").includes(searchQuery) ||
      (sale.customerPhone || "").includes(searchQuery)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المبيعات</h1>
          <p className="text-muted-foreground mt-1">سجل جميع عمليات البيع</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/sales/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              بيع جديد
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
                placeholder="بحث بالاسم أو رقم الفاتورة أو الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="حالة الدفع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="paid">مدفوع</SelectItem>
                <SelectItem value="partial">مدفوع جزئياً</SelectItem>
                <SelectItem value="unpaid">غير مدفوع</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
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
              <p className="text-sm text-muted-foreground mt-1">{(error as any).message}</p>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">لا توجد فواتير</p>
              <p className="text-sm mt-1">ابدأ بإنشاء فاتورة جديدة من نقطة البيع</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="data-table-header">
                  <TableHead className="text-right">رقم الفاتورة</TableHead>
                  <TableHead className="text-right">الزبون</TableHead>
                  <TableHead className="text-center">التاريخ</TableHead>
                  <TableHead className="text-center">النوع</TableHead>
                  <TableHead className="text-center">الإجمالي</TableHead>
                  <TableHead className="text-center">المدفوع</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead className="text-center w-32">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale: Sale) => (
                  <TableRow key={sale.id} className="data-table-row">
                    <TableCell className="font-mono text-sm">{sale.saleNumber}</TableCell>
                    <TableCell className="font-medium">
                      {sale.customerName || "زبون عادي"}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {formatDate(sale.saleDate)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{getSaleTypeLabel(sale.saleType)}</span>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{formatCurrency(sale.totalAmount)}</TableCell>
                    <TableCell className="text-center text-green-600 dark:text-green-400">{formatCurrency(sale.amountPaid)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <DocumentStatusBadge docstatus={(sale as any).docstatus ?? (sale.isVoided ? 2 : 1)} isVoided={sale.isVoided} />
                        {getPaymentStatusBadge(sale.paymentStatus, sale.isVoided)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Eye - View Details */}
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="عرض التفاصيل"
                          onClick={() => setDetailSaleId(sale.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {/* Add Payment (only if not paid/voided) */}
                        {!sale.isVoided && sale.paymentStatus !== "paid" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" title="تسجيل دفعة"
                            onClick={() => navigate(`/payments/new?saleId=${sale.id}`)}>
                            <CreditCard className="w-4 h-4" />
                          </Button>
                        )}
                        {/* Void (only if not already voided) */}
                        {!sale.isVoided && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="إلغاء الفاتورة"
                            onClick={() => setVoidSaleId(sale.id)}>
                            <Ban className="w-4 h-4" />
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pagination
            ? `عرض ${filteredSales.length} من ${pagination.totalItems} فاتورة — صفحة ${pagination.page} من ${pagination.totalPages}`
            : `عرض ${filteredSales.length} فاتورة`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination?.hasPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination?.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      </div>

      {/* Detail Card Dialog */}
      {detailSaleId && (
        <SaleDetailCard
          saleId={detailSaleId}
          open={!!detailSaleId}
          onClose={() => setDetailSaleId(null)}
        />
      )}

      {/* Void Sale Dialog */}
      {voidSaleId && (
        <VoidSaleDialog
          saleId={voidSaleId}
          open={!!voidSaleId}
          onClose={() => setVoidSaleId(null)}
        />
      )}
    </div>
  );
}
