import { useState } from "react";
import { Eye, Loader2, ArrowUpRight, ArrowDownLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { useReceivables, usePayables, useDebtSummary, useDebt } from "@/hooks/use-debts";
import { Debt } from "@/types/debts";

function formatCurrency(v: number) { return `₪ ${(v / 100).toFixed(2)}`; }
function formatDate(d: string) { return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" }); }

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
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
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
                            <Info label="المبلغ الأصلي" value={formatCurrency(debt.originalAmount)} />
                            <Info label="المتبقي" value={formatCurrency(debt.remainingAmount)} highlight />
                            {debt.dueDate && <Info label="تاريخ الاستحقاق" value={formatDate(debt.dueDate)} />}
                            {debt.isOverdue && <Info label="متأخر" value={<StatusBadge status="danger">متأخر</StatusBadge>} />}
                            <Info label="تاريخ الإنشاء" value={formatDate(debt.createdAt)} />
                        </div>
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
    debts: Debt[]; isLoading: boolean; error: any; isReceivable: boolean;
}) {
    const [detailId, setDetailId] = useState<number | null>(null);

    return (
        <>
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : error ? (
                        <div className="text-center py-16 text-red-500"><p>حدث خطأ</p></div>
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
                                        <TableCell className="font-medium">{isReceivable ? d.customerName : d.supplierName}</TableCell>
                                        <TableCell className="text-center text-sm text-muted-foreground font-mono">{d.saleNumber || d.purchaseNumber || "-"}</TableCell>
                                        <TableCell className="text-center">{formatCurrency(d.originalAmount)}</TableCell>
                                        <TableCell className="text-center font-semibold text-red-600 dark:text-red-400">{formatCurrency(d.remainingAmount)}</TableCell>
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

    const { data: recvData, isLoading: recvLoading, error: recvError } = useReceivables();
    const { data: payData, isLoading: payLoading, error: payError } = usePayables();
    const { data: summary } = useDebtSummary();

    const receivables = recvData?.data || [];
    const payables = payData?.data || [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">الديون</h1>
                <p className="text-muted-foreground mt-1">إدارة المستحقات والالتزامات</p>
            </div>

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
                    <ArrowDownLeft className="w-4 h-4" /> مستحقات لنا ({receivables.length})
                </Button>
                <Button variant={tab === "payables" ? "default" : "outline"} onClick={() => setTab("payables")} className="gap-2">
                    <ArrowUpRight className="w-4 h-4" /> مستحقات علينا ({payables.length})
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
