import { useState } from "react";
import { Eye, Plus, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import {
    useAccounts, useJournalEntries, useJournalEntry, useTrialBalance, usePostJournalEntry,
} from "@/hooks/use-accounting";
import { Account, JournalEntry, TrialBalanceEntry } from "@/types/accounting";

function formatCurrency(v: number) { return `₪ ${(v / 100).toFixed(2)}`; }
function formatDate(d: string) { return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" }); }

const typeLabels: Record<string, string> = {
    asset: "أصول", liability: "خصوم", equity: "حقوق ملكية", revenue: "إيرادات", expense: "مصروفات",
};

function JournalDetailCard({ entryId, open, onClose }: { entryId: number; open: boolean; onClose: () => void }) {
    const { data: entry, isLoading } = useJournalEntry(entryId);
    const postEntry = usePostJournalEntry();

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
                <DialogHeader><DialogTitle className="text-xl font-bold">تفاصيل القيد {entry?.entryNumber || ""}</DialogTitle></DialogHeader>
                {isLoading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : entry ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <Info label="رقم القيد" value={entry.entryNumber} />
                            <Info label="التاريخ" value={formatDate(entry.entryDate)} />
                            <Info label="الحالة" value={
                                entry.status === "posted"
                                    ? <StatusBadge status="success">مرحّل</StatusBadge>
                                    : <StatusBadge status="warning">مسودة</StatusBadge>
                            } />
                            <Info label="إجمالي المدين" value={formatCurrency(entry.totalDebit)} />
                            <Info label="إجمالي الدائن" value={formatCurrency(entry.totalCredit)} />
                        </div>
                        <Info label="الوصف" value={entry.description} />

                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="text-right">الحساب</TableHead>
                                        <TableHead className="text-center">مدين</TableHead>
                                        <TableHead className="text-center">دائن</TableHead>
                                        <TableHead className="text-right">الوصف</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {entry.lines.map((line) => (
                                        <TableRow key={line.id}>
                                            <TableCell>
                                                <span className="font-mono text-xs mr-1">{line.accountCode}</span>
                                                <span className="font-medium">{line.accountName}</span>
                                            </TableCell>
                                            <TableCell className="text-center">{line.debit > 0 ? formatCurrency(line.debit) : "-"}</TableCell>
                                            <TableCell className="text-center">{line.credit > 0 ? formatCurrency(line.credit) : "-"}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{line.description || "-"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {entry.status === "draft" && (
                            <Button className="gap-2 w-full" onClick={() => postEntry.mutate(entry.id)} disabled={postEntry.isPending}>
                                {postEntry.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                ترحيل القيد
                            </Button>
                        )}
                    </div>
                ) : <p className="text-center text-muted-foreground py-8">لم يتم العثور</p>}
            </DialogContent>
        </Dialog>
    );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            <p className="text-sm font-medium">{value}</p>
        </div>
    );
}

export default function Accounting() {
    const [tab, setTab] = useState<"accounts" | "journals" | "trial">("accounts");
    const [journalPage, setJournalPage] = useState(1);
    const [detailEntryId, setDetailEntryId] = useState<number | null>(null);

    const { data: accountsData, isLoading: accountsLoading } = useAccounts();
    const { data: journalsData, isLoading: journalsLoading } = useJournalEntries({ page: journalPage, pageSize: 20 });
    const { data: trialData, isLoading: trialLoading } = useTrialBalance();

    const accounts = accountsData?.data || [];
    const journals = journalsData?.data || [];
    const journalPagination = journalsData?.pagination;
    const trialBalance = trialData || [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">المحاسبة</h1>
                <p className="text-muted-foreground mt-1">دليل الحسابات وقيود اليومية</p>
            </div>

            <div className="flex gap-2">
                <Button variant={tab === "accounts" ? "default" : "outline"} onClick={() => setTab("accounts")}>دليل الحسابات</Button>
                <Button variant={tab === "journals" ? "default" : "outline"} onClick={() => setTab("journals")}>قيود اليومية</Button>
                <Button variant={tab === "trial" ? "default" : "outline"} onClick={() => setTab("trial")}>ميزان المراجعة</Button>
            </div>

            {/* Chart of Accounts Tab */}
            {tab === "accounts" && (
                <Card>
                    <CardContent className="p-0">
                        {accountsLoading ? (
                            <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                        ) : accounts.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground"><p>لا توجد حسابات</p></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="data-table-header">
                                        <TableHead className="text-right">الرمز</TableHead>
                                        <TableHead className="text-right">اسم الحساب</TableHead>
                                        <TableHead className="text-center">النوع</TableHead>
                                        <TableHead className="text-center">الرصيد</TableHead>
                                        <TableHead className="text-center">الحالة</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {accounts.map((a: Account) => (
                                        <TableRow key={a.id} className="data-table-row">
                                            <TableCell className="font-mono text-sm">{a.code}</TableCell>
                                            <TableCell className="font-medium">{a.nameAr || a.name}</TableCell>
                                            <TableCell className="text-center">{typeLabels[a.accountType] || a.accountType}</TableCell>
                                            <TableCell className="text-center font-semibold">{formatCurrency(a.balance)}</TableCell>
                                            <TableCell className="text-center">
                                                {a.isActive ? <StatusBadge status="success">نشط</StatusBadge> : <StatusBadge status="default">غير نشط</StatusBadge>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Journal Entries Tab */}
            {tab === "journals" && (
                <>
                    <Card>
                        <CardContent className="p-0">
                            {journalsLoading ? (
                                <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                            ) : journals.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground"><p>لا توجد قيود</p></div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="data-table-header">
                                            <TableHead className="text-right">رقم القيد</TableHead>
                                            <TableHead className="text-right">الوصف</TableHead>
                                            <TableHead className="text-center">التاريخ</TableHead>
                                            <TableHead className="text-center">المدين</TableHead>
                                            <TableHead className="text-center">الدائن</TableHead>
                                            <TableHead className="text-center">الحالة</TableHead>
                                            <TableHead className="text-center w-16">عرض</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {journals.map((j: JournalEntry) => (
                                            <TableRow key={j.id} className="data-table-row">
                                                <TableCell className="font-mono text-sm">{j.entryNumber}</TableCell>
                                                <TableCell className="max-w-[200px] truncate">{j.description}</TableCell>
                                                <TableCell className="text-center text-muted-foreground">{formatDate(j.entryDate)}</TableCell>
                                                <TableCell className="text-center">{formatCurrency(j.totalDebit)}</TableCell>
                                                <TableCell className="text-center">{formatCurrency(j.totalCredit)}</TableCell>
                                                <TableCell className="text-center">
                                                    {j.status === "posted" ? <StatusBadge status="success">مرحّل</StatusBadge> : <StatusBadge status="warning">مسودة</StatusBadge>}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailEntryId(j.id)}>
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
                        <p className="text-sm text-muted-foreground">{journalPagination ? `صفحة ${journalPagination.page} من ${journalPagination.totalPages}` : ""}</p>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" disabled={!journalPagination?.hasPrev} onClick={() => setJournalPage(p => Math.max(1, p - 1))}>السابق</Button>
                            <Button variant="outline" size="sm" disabled={!journalPagination?.hasNext} onClick={() => setJournalPage(p => p + 1)}>التالي</Button>
                        </div>
                    </div>
                </>
            )}

            {/* Trial Balance Tab */}
            {tab === "trial" && (
                <Card>
                    <CardContent className="p-0">
                        {trialLoading ? (
                            <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                        ) : trialBalance.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground"><p>لا توجد بيانات</p></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="data-table-header">
                                        <TableHead className="text-right">الرمز</TableHead>
                                        <TableHead className="text-right">الحساب</TableHead>
                                        <TableHead className="text-center">النوع</TableHead>
                                        <TableHead className="text-center">مدين</TableHead>
                                        <TableHead className="text-center">دائن</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {trialBalance.map((t: TrialBalanceEntry) => (
                                        <TableRow key={t.accountId} className="data-table-row">
                                            <TableCell className="font-mono text-sm">{t.accountCode}</TableCell>
                                            <TableCell className="font-medium">{t.accountName}</TableCell>
                                            <TableCell className="text-center text-sm">{typeLabels[t.accountType] || t.accountType}</TableCell>
                                            <TableCell className="text-center">{t.debit > 0 ? formatCurrency(t.debit) : "-"}</TableCell>
                                            <TableCell className="text-center">{t.credit > 0 ? formatCurrency(t.credit) : "-"}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-muted/50 font-bold">
                                        <TableCell colSpan={3} className="text-left">الإجمالي</TableCell>
                                        <TableCell className="text-center">{formatCurrency(trialBalance.reduce((s: number, t: TrialBalanceEntry) => s + t.debit, 0))}</TableCell>
                                        <TableCell className="text-center">{formatCurrency(trialBalance.reduce((s: number, t: TrialBalanceEntry) => s + t.credit, 0))}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}

            {detailEntryId && <JournalDetailCard entryId={detailEntryId} open={!!detailEntryId} onClose={() => setDetailEntryId(null)} />}
        </div>
    );
}
