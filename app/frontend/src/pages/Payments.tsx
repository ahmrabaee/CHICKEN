import { useState } from "react";
import { Search, Eye, Loader2, Plus, Ban, Download } from "lucide-react";
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
import { DocumentStatusBadge, CancelConfirmDialog } from "@/components/posting";
import { usePayments, usePayment, useCancelPayment } from "@/hooks/use-payments";
import { Payment } from "@/types/payments";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { downloadReportPdf } from "@/services/pdf.service";

function formatCurrency(v: number) { return `₪ ${(v / 100).toFixed(2)}`; }
function formatDate(d: string) { return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" }); }


const methodLabels: Record<string, string> = {
    cash: "نقدي", card: "بطاقة", bank_transfer: "تحويل بنكي", mobile_payment: "دفع إلكتروني", check: "شيك",
};

function PaymentDetailCard({ paymentId, open, onClose }: { paymentId: number; open: boolean; onClose: () => void }) {
    const { data: payment, isLoading } = usePayment(paymentId);
    const cancelPayment = useCancelPayment();
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

    const handleDownloadPdf = async () => {
        setPdfLoading(true);
        try {
            await downloadReportPdf("payment-voucher", { id: paymentId, language: "ar" });
            toast({ title: "تم التحميل", description: "تم تحميل سند الدفع بنجاح" });
        } catch {
            toast({ variant: "destructive", title: "فشل التحميل", description: "تعذر تحميل ملف PDF" });
        } finally {
            setPdfLoading(false);
        }
    };
    const docstatus = payment?.docstatus ?? (payment?.isVoided ? 2 : 1);
    const canCancel = docstatus === 1 && !payment?.isVoided;

    const partyTypeLabels: Record<string, string> = { customer: "زبون", supplier: "مورد" };

    const handleCancelConfirm = (reason: string) => {
        cancelPayment.mutate(
            { id: paymentId, data: { reason } },
            { onSuccess: () => { setShowCancelDialog(false); onClose(); } }
        );
    };

    return (
        <>
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto" dir="rtl" style={{ textAlign: "right" }}>
                <DialogHeader>
                    <div className="flex items-center justify-between gap-4 flex-row-reverse">
                        <DialogTitle className="text-xl font-bold flex items-center gap-3 flex-row-reverse">
                            تفاصيل الدفعة {payment?.paymentNumber || ""}
                            <DocumentStatusBadge docstatus={docstatus} isVoided={payment?.isVoided} />
                        </DialogTitle>
                        {payment && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 shrink-0"
                                onClick={handleDownloadPdf}
                                disabled={pdfLoading}
                            >
                                {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                تحميل PDF
                            </Button>
                        )}
                    </div>
                </DialogHeader>
                {isLoading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : payment ? (
                    <div className="space-y-5">
                        {/* Core Payment Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <Info label="معرّف النظام" value={`#${payment.id}`} />
                            <Info label="رقم الدفعة" value={payment.paymentNumber} />
                            <Info label="التاريخ" value={formatDate(payment.paymentDate)} />
                            <Info label="المبلغ" value={formatCurrency(payment.amount)} highlight />
                            <Info label="طريقة الدفع" value={methodLabels[payment.paymentMethod] || payment.paymentMethod} />
                            <Info label="الحالة" value={<DocumentStatusBadge docstatus={docstatus} isVoided={payment.isVoided} />} />
                        </div>

                        {/* Reference & Party */}
                        <div className="border-t pt-4">
                            <p className="text-xs font-bold text-slate-500 mb-3">المرجع والطرف</p>
                            <div className="grid grid-cols-2 gap-4">
                                <Info label="النوع" value={!payment.referenceType ? "دفعة مسبقة" : payment.referenceType === "sale" ? "دفعة مبيعات" : "دفعة مشتريات"} />
                                <Info label="رقم المرجع (ID)" value={payment.referenceId != null ? `#${payment.referenceId}` : "—"} />
                                {payment.saleNumber && <Info label="رقم الفاتورة" value={payment.saleNumber} />}
                                {payment.purchaseNumber && <Info label="رقم أمر الشراء" value={payment.purchaseNumber} />}
                                <Info label="نوع الطرف" value={payment.partyType ? (partyTypeLabels[payment.partyType] || payment.partyType) : "—"} />
                                <Info label="معرّف الطرف" value={payment.partyId ? `#${payment.partyId}` : "—"} />
                                <Info label="اسم الطرف" value={payment.partyName || "—"} />
                            </div>
                        </div>

                        {/* Additional Details — always shown */}
                        <div className="border-t pt-4">
                            <p className="text-xs font-bold text-slate-500 mb-3">بيانات إضافية</p>
                            <div className="grid grid-cols-2 gap-4">
                                <Info label="رقم الإيصال" value={payment.receiptNumber || "—"} />
                                <Info label="معرّف العملية البنكية" value={payment.bankTransactionId || "—"} />
                            </div>
                        </div>

                        {/* Notes — always shown */}
                        <div className="border-t pt-4">
                            <p className="text-xs font-bold text-slate-500 mb-2">ملاحظات</p>
                            <p className="text-sm bg-muted/30 rounded-lg p-3">{payment.notes || "—"}</p>
                        </div>

                        {/* Received By & Branch — always shown */}
                        <div className="border-t pt-4">
                            <p className="text-xs font-bold text-slate-500 mb-3">معلومات التسجيل</p>
                            <div className="grid grid-cols-2 gap-4">
                                <Info label="بواسطة" value={payment.receivedBy ? (payment.receivedBy.fullName || payment.receivedBy.username) : "—"} />
                                <Info label="رقم الموظف" value={payment.receivedBy?.employeeNumber || "—"} />
                                <Info label="الفرع" value={payment.branch ? payment.branch.name : "—"} />
                                <Info label="تاريخ الإنشاء" value={formatDate(payment.createdAt)} />
                                {payment.updatedAt !== payment.createdAt && (
                                    <Info label="آخر تحديث" value={formatDate(payment.updatedAt)} />
                                )}
                            </div>
                        </div>

                        {canCancel && (
                            <div className="border-t pt-4 flex justify-end" style={{ flexDirection: "row-reverse" }}>
                                <Button
                                    variant="destructive"
                                    onClick={() => setShowCancelDialog(true)}
                                    className="gap-2"
                                >
                                    <Ban className="w-4 h-4" />
                                    إلغاء الدفعة
                                </Button>
                            </div>
                        )}
                    </div>
                ) : <p className="text-center text-muted-foreground py-8">لم يتم العثور على الدفعة</p>}
            </DialogContent>
        </Dialog>
        <CancelConfirmDialog
            open={showCancelDialog}
            onClose={() => setShowCancelDialog(false)}
            onConfirm={handleCancelConfirm}
            title="إلغاء الدفعة"
            entityLabel="الدفعة"
            glReversalNote={true}
            isPending={cancelPayment.isPending}
        />
    </>
    );
}

function Info({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            <p className={`text-sm font-medium ${highlight ? "text-primary text-base" : ""}`}>{value}</p>
        </div>
    );
}

export default function Payments() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [page, setPage] = useState(1);

    const queryParams = {
        page, pageSize: 20,
        ...(typeFilter !== "all" ? { type: typeFilter as any } : {}),
    };

    const { data, isLoading, error } = usePayments(queryParams);
    const payments = data?.data || [];
    const pagination = data?.pagination;
    const [detailId, setDetailId] = useState<number | null>(null);

    const filtered = payments.filter((p: Payment) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            p.paymentNumber?.toLowerCase().includes(q) ||
            (p.partyName || "").includes(searchQuery) ||
            (p.saleNumber || "").toLowerCase().includes(q) ||
            (p.purchaseNumber || "").toLowerCase().includes(q) ||
            (p.receiptNumber || "").toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">المدفوعات</h1>
                    <p className="text-muted-foreground mt-1">سجل جميع المدفوعات الواردة والصادرة</p>
                </div>
                <Button className="gap-2" onClick={() => navigate("/payments/new")}>
                    <Plus className="w-4 h-4" />
                    تسجيل دفعة
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="بحث برقم الدفعة أو الفاتورة أو الاسم..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
                        </div>
                        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                            <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="النوع" /></SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="sale">مبيعات</SelectItem>
                                <SelectItem value="purchase">مشتريات</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="mr-3 text-muted-foreground">جاري التحميل...</span></div>
                    ) : error ? (
                        <div className="text-center py-16 text-red-500"><p>حدث خطأ في تحميل البيانات</p></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground"><p className="text-lg">لا توجد مدفوعات</p></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="data-table-header">
                                    <TableHead className="text-right">رقم الدفعة</TableHead>
                                    <TableHead className="text-center">التاريخ</TableHead>
                                    <TableHead className="text-center">النوع</TableHead>
                                    <TableHead className="text-center">المبلغ</TableHead>
                                    <TableHead className="text-center">طريقة الدفع</TableHead>
                                    <TableHead className="text-right">المرجع</TableHead>
                                    <TableHead className="text-center w-16">عرض</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((p: Payment) => (
                                    <TableRow key={p.id} className="data-table-row">
                                        <TableCell className="font-mono text-sm">{p.paymentNumber}</TableCell>
                                        <TableCell className="text-center text-muted-foreground">{formatDate(p.paymentDate)}</TableCell>
                                        <TableCell className="text-center">
                                            <StatusBadge status={p.referenceType === "sale" ? "success" : "info"}>
                                                {p.referenceType === "sale" ? "مبيعات" : "مشتريات"}
                                            </StatusBadge>
                                        </TableCell>
                                        <TableCell className="text-center font-semibold">{formatCurrency(p.amount)}</TableCell>
                                        <TableCell className="text-center">{methodLabels[p.paymentMethod] || p.paymentMethod}</TableCell>
                                        <TableCell className="text-right text-sm text-muted-foreground">
                                            {p.saleNumber || p.purchaseNumber || "-"}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailId(p.id)}>
                                                <Eye className="w-4 h-4" />
                                            </Button>
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
                    {pagination ? `صفحة ${pagination.page} من ${pagination.totalPages} — ${pagination.totalItems} دفعة` : `${filtered.length} دفعة`}
                </p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={!pagination?.hasPrev} onClick={() => setPage(p => Math.max(1, p - 1))}>السابق</Button>
                    <Button variant="outline" size="sm" disabled={!pagination?.hasNext} onClick={() => setPage(p => p + 1)}>التالي</Button>
                </div>
            </div>

            {detailId && <PaymentDetailCard paymentId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />}
        </div>
    );
}
