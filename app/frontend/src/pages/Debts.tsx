import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Eye, Loader2, ArrowUpRight, ArrowDownLeft, AlertTriangle, Download, XCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { useReceivables, usePayables, useDebtSummary, useDebt } from "@/hooks/use-debts";
import { Debt } from "@/types/debts";
import { PdfPreviewDialog } from "@/components/reports/PdfPreviewDialog";
import { formatCurrency, computeDebtNumbers } from "@/lib/formatters";
import { debtService } from "@/services/debt.service";
import { toast } from "@/hooks/use-toast";

function formatDate(d: string) { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }

function getStatusBadge(status: string) {
    const map: Record<string, { type: "success" | "warning" | "danger" | "default"; label: string }> = {
        outstanding: { type: "danger", label: "قائم" },
        partial: { type: "warning", label: "جزئي" },
        settled: { type: "success", label: "مسدد" },
        written_off: { type: "default", label: "شُطب" },
    };
    const entry = map[status] || { type: "default" as const, label: status };
    return <StatusBadge status={entry.type}>{entry.label}</StatusBadge>;
}

function DebtDetailCard({ debtId, open, onClose }: { debtId: number; open: boolean; onClose: () => void }) {
    const { data: debt, isLoading } = useDebt(debtId);
    const queryClient = useQueryClient();
    const [showWriteOff, setShowWriteOff] = useState(false);
    const [writeOffReason, setWriteOffReason] = useState('');

    const writeOff = useMutation({
        mutationFn: () => debtService.writeOffDebt(debtId, writeOffReason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['debts'] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast({ title: 'تم شطب الدين بنجاح' });
            setShowWriteOff(false);
            onClose();
        },
        onError: (error: any) => {
            const msg = error?.response?.data?.messageAr ?? error?.message ?? 'حدث خطأ';
            toast({ variant: 'destructive', title: 'خطأ في شطب الدين', description: msg });
        },
    });

    const canWriteOff = debt && !['written_off', 'settled', 'paid'].includes(debt.status) && debt.debtType === 'receivable';

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto" dir="rtl">
                <DialogHeader><DialogTitle className="text-xl font-bold">تفاصيل الدين</DialogTitle></DialogHeader>
                {isLoading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : debt ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Info label="النوع" value={debt.debtType === "receivable" ? "مستحقات (لنا)" : "مستحقات (علينا)"} />
                            <Info label="الحالة" value={getStatusBadge(debt.status)} />
                            {debt.customerName && <Info label="الزبون" value={debt.customerName} />}
                            {debt.supplierName && <Info label="التاجر" value={debt.supplierName} />}
                            {debt.saleNumber && <Info label="رقم الفاتورة" value={debt.saleNumber} />}
                            {debt.purchaseNumber && <Info label="رقم الطلب" value={debt.purchaseNumber} />}
                            {(() => {
                                const { original, remaining } = computeDebtNumbers(debt as unknown as Record<string, unknown>);
                                return (
                                    <>
                                        <Info label="المبلغ الأصلي" value={formatCurrency(original)} />
                                        <Info label="المتبقي" value={formatCurrency(remaining)} highlight />
                                    </>
                                );
                            })()}
                            {debt.dueDate && <Info label="تاريخ الاستحقاق" value={formatDate(debt.dueDate)} />}
                            {debt.isOverdue && <Info label="متأخر" value={<StatusBadge status="danger">متأخر</StatusBadge>} />}
                            <Info label="تاريخ الإنشاء" value={formatDate(debt.createdAt)} />
                        </div>

                        {/* UI-05: Write-off action for receivable debts only */}
                        {canWriteOff && !showWriteOff && (
                            <Button
                                variant="destructive"
                                size="sm"
                                className="gap-2 w-full"
                                onClick={() => setShowWriteOff(true)}
                            >
                                <XCircle className="w-4 h-4" />
                                شطب الدين
                            </Button>
                        )}
                        {canWriteOff && showWriteOff && (
                            <div className="space-y-3 border border-red-300 rounded-md p-4 bg-red-50 dark:bg-red-950/20">
                                <Label className="text-sm font-medium">سبب الشطب</Label>
                                <Input
                                    placeholder="أدخل سبب شطب الدين..."
                                    value={writeOffReason}
                                    onChange={(e) => setWriteOffReason(e.target.value)}
                                    dir="rtl"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={!writeOffReason.trim() || writeOff.isPending}
                                        onClick={() => writeOff.mutate()}
                                        className="gap-1"
                                    >
                                        {writeOff.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                                        تأكيد الشطب
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setShowWriteOff(false)}>إلغاء</Button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : <p className="text-center text-muted-foreground py-8">لم يتم العثور على الدين</p>}
            </DialogContent>
        </Dialog>
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

function DebtTable({ debts, isLoading, error, isReceivable }: {
    debts: Debt[]; isLoading: boolean; error: unknown; isReceivable: boolean;
}) {
    const [detailId, setDetailId] = useState<number | null>(null);

    return (
        <>
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : error ? (
                        <div className="text-center py-16 text-red-500">
                            <p>حدث خطأ في تحميل البيانات</p>
                            {/* UI-10: Show actual error message instead of generic text */}
                            <p className="text-sm mt-1 text-muted-foreground">
                                {(error as any)?.response?.data?.messageAr ?? (error as any)?.message ?? 'خطأ غير متوقع'}
                            </p>
                        </div>
                    ) : debts.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground"><p>لا توجد ديون</p></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="data-table-header">
                                    <TableHead className="text-right">{isReceivable ? "الزبون" : "التاجر"}</TableHead>
                                    <TableHead className="text-center">المرجع</TableHead>
                                    <TableHead className="text-center">المبلغ الأصلي</TableHead>
                                    <TableHead className="text-center">المتبقي</TableHead>
                                    <TableHead className="text-center">الاستحقاق</TableHead>
                                    <TableHead className="text-center">الحالة</TableHead>
                                    <TableHead className="text-center w-16">عرض</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {debts.map((d) => (
                                    <TableRow key={d.id} className="data-table-row">
                                        <TableCell className="font-medium">
                                            {isReceivable
                                                ? (d.customerName ?? d.partyName ?? "—")
                                                : (d.supplierName ?? d.partyName ?? "—")}
                                        </TableCell>
                                        <TableCell className="text-center text-sm text-muted-foreground font-mono">
                                            {d.saleNumber || d.purchaseNumber || d.debtNumber || "—"}
                                        </TableCell>
                                        <TableCell className="text-center">{formatCurrency(computeDebtNumbers(d as unknown as Record<string, unknown>).original)}</TableCell>
                                        <TableCell className="text-center font-semibold text-red-600 dark:text-red-400">{formatCurrency(computeDebtNumbers(d as unknown as Record<string, unknown>).remaining)}</TableCell>
                                        <TableCell className="text-center text-muted-foreground">{d.dueDate ? formatDate(d.dueDate) : "-"}</TableCell>
                                        <TableCell className="text-center">{getStatusBadge(d.status)}</TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailId(d.id)}>
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
            {detailId && <DebtDetailCard debtId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />}
        </>
    );
}

export default function Debts() {
    const [tab, setTab] = useState<"receivables" | "payables">("receivables");
    const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
    const [autoPrint, setAutoPrint] = useState(false);

    const openPdf = (print = false) => {
        setAutoPrint(print);
        setPdfDialogOpen(true);
    };

    const { data: recvData, isLoading: recvLoading, error: recvError } = useReceivables();
    const { data: payData, isLoading: payLoading, error: payError } = usePayables();
    const { data: summary } = useDebtSummary();

    const receivables = recvData?.data || [];
    const payables = payData?.data || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">الديون</h1>
                    <p className="text-muted-foreground mt-1">إدارة المستحقات والالتزامات</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        className="gap-2 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-200"
                        onClick={() => openPdf(false)}
                    >
                        <Download className="w-4 h-4" />
                        تصدير PDF
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => openPdf(true)}>
                        <Printer className="w-4 h-4" />
                        طباعة
                    </Button>
                </div>
            </div>
            <PdfPreviewDialog
                open={pdfDialogOpen}
                onOpenChange={(v) => { setPdfDialogOpen(v); if (!v) setAutoPrint(false); }}
                reportType={tab === "receivables" ? "receivables-report" : "payables-report"}
                params={{ language: "ar" }}
                title={tab === "receivables" ? "تقرير الذمم المدينة PDF" : "تقرير الذمم الدائنة PDF"}
                autoPrint={autoPrint}
            />

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><ArrowDownLeft className="w-4 h-4 text-green-500" />مستحقات لنا</CardTitle></CardHeader>
                        <CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalReceivables)}</p></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-red-500" />مستحقات علينا</CardTitle></CardHeader>
                        <CardContent><p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalPayables)}</p></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-500" />صافي الموقف</CardTitle></CardHeader>
                        <CardContent><p className={`text-2xl font-bold ${summary.netPosition >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(summary.netPosition)}</p></CardContent>
                    </Card>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2">
                <Button variant={tab === "receivables" ? "default" : "outline"} onClick={() => setTab("receivables")} className="gap-2">
                    <ArrowDownLeft className="w-4 h-4" /> مستحقات لنا ({recvData?.pagination?.totalItems ?? receivables.length})
                </Button>
                <Button variant={tab === "payables" ? "default" : "outline"} onClick={() => setTab("payables")} className="gap-2">
                    <ArrowUpRight className="w-4 h-4" /> مستحقات علينا ({payData?.pagination?.totalItems ?? payables.length})
                </Button>
            </div>

            {tab === "receivables" ? (
                <DebtTable debts={receivables} isLoading={recvLoading} error={recvError} isReceivable={true} />
            ) : (
                <DebtTable debts={payables} isLoading={payLoading} error={payError} isReceivable={false} />
            )}
        </div>
    );
}
