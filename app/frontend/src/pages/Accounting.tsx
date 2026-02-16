import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Loader2, CheckCircle, Plus, Search, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import {
    useAccounts, useJournalEntries, useJournalEntry, useTrialBalance, usePostJournalEntry,
    useDeleteAccount,
} from "@/hooks/use-accounting";
import { AccountFormDialog } from "@/components/accounting/AccountFormDialog";
import { AccountLedgerDialog } from "@/components/accounting/AccountLedgerDialog";
import { AccountProfileDialog } from "@/components/accounting/AccountProfileDialog";
import { toast } from "@/hooks/use-toast";
import { accountingService } from "@/services/accounting.service";
import { Account, JournalEntry, TrialBalanceEntry } from "@/types/accounting";
import { AccountTreeRow } from "@/components/accounting/AccountTreeRow";
import { ROOT_TYPE_COLORS } from "@/lib/accounting";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Input } from "@/components/ui/input";



function entryStatus(entry: JournalEntry): 'draft' | 'posted' {
    return entry.status ?? (entry.isPosted ? 'posted' : 'draft');
}
function entryTotalDebit(entry: JournalEntry): number {
    if (entry.totalDebit != null) return entry.totalDebit;
    return entry.lines?.reduce((s, l) => s + (l.debit ?? l.debitAmount ?? 0), 0) ?? 0;
}
function entryTotalCredit(entry: JournalEntry): number {
    if (entry.totalCredit != null) return entry.totalCredit;
    return entry.lines?.reduce((s, l) => s + (l.credit ?? l.creditAmount ?? 0), 0) ?? 0;
}

const typeLabels: Record<string, string> = {
    ...Object.fromEntries(Object.entries(ROOT_TYPE_COLORS).map(([k, v]) => [k, v.label])),
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
                                entryStatus(entry) === "posted"
                                    ? <StatusBadge status="success">مرحّل</StatusBadge>
                                    : <StatusBadge status="warning">مسودة</StatusBadge>
                            } />
                            {entry.isReversed && (
                                <Info label="معكوس" value={
                                    <span className="text-amber-600 flex items-center gap-1">
                                        قيد معكوس — عكس بواسطة #{(entry.reversedByEntryId ?? entry.reversedByEntry?.id) || "?"}
                                    </span>
                                } />
                            )}
                            <Info label="إجمالي المدين" value={formatCurrency(entryTotalDebit(entry))} />
                            <Info label="إجمالي الدائن" value={formatCurrency(entryTotalCredit(entry))} />
                        </div>

                        {/* Profit Summary Section */}
                        {(() => {
                            const income = entry.lines.filter(l => l.account?.rootType === 'Income')
                                .reduce((sum, l) => sum + (l.credit ?? l.creditAmount ?? 0) - (l.debit ?? l.debitAmount ?? 0), 0);
                            const expense = entry.lines.filter(l => l.account?.rootType === 'Expense')
                                .reduce((sum, l) => sum + (l.debit ?? l.debitAmount ?? 0) - (l.credit ?? l.creditAmount ?? 0), 0);

                            if (income === 0 && expense === 0) return null;
                            const profit = income - expense;

                            return (
                                <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 flex flex-wrap gap-6 items-center justify-between">
                                    <div className="flex gap-6">
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">إجمالي المبيعات</p>
                                            <p className="text-sm font-semibold">{formatCurrency(income)}</p>
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">تكلفة البضاعة</p>
                                            <p className="text-sm font-semibold">{formatCurrency(expense)}</p>
                                        </div>
                                    </div>
                                    <div className="text-left space-y-0.5">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">صافي الربح</p>
                                        <p className={`text-lg font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                            {formatCurrency(profit)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}

                        <Info label="الوصف" value={entry.description} />

                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="text-right">الحساب</TableHead>
                                        <TableHead className="text-center">مدين</TableHead>
                                        <TableHead className="text-center">دائن</TableHead>
                                        <TableHead className="text-right">مركز التكلفة</TableHead>
                                        <TableHead className="text-right">الوصف</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {entry.lines.map((line) => {
                                        const debitVal = line.debit ?? line.debitAmount ?? 0;
                                        const creditVal = line.credit ?? line.creditAmount ?? 0;
                                        const debitInAcc = line.debitInAccountCurrency ?? debitVal;
                                        const creditInAcc = line.creditInAccountCurrency ?? creditVal;
                                        const accountCurrency = line.account?.accountCurrency;
                                        const showAccountCurrency = accountCurrency && accountCurrency !== "SAR";
                                        return (
                                            <TableRow
                                                key={line.id}
                                                className={line.isRoundOff ? "bg-amber-50 dark:bg-amber-950/20" : ""}
                                            >
                                                <TableCell>
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <span className="font-mono text-xs mr-1">{line.account?.code ?? line.accountCode}</span>
                                                        <span className="font-medium">{line.account?.name ?? line.accountName}</span>
                                                        {line.isRoundOff && <Badge variant="outline" className="text-xs">تدوير</Badge>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {debitVal > 0 ? (
                                                        <div>
                                                            {formatCurrency(debitVal)}
                                                            {showAccountCurrency && (debitInAcc > 0 || debitVal !== debitInAcc) && (
                                                                <span className="text-xs text-muted-foreground block">{formatCurrency(debitInAcc)} {accountCurrency}</span>
                                                            )}
                                                        </div>
                                                    ) : "-"}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {creditVal > 0 ? (
                                                        <div>
                                                            {formatCurrency(creditVal)}
                                                            {showAccountCurrency && (creditInAcc > 0 || creditVal !== creditInAcc) && (
                                                                <span className="text-xs text-muted-foreground block">{formatCurrency(creditInAcc)} {accountCurrency}</span>
                                                            )}
                                                        </div>
                                                    ) : "-"}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {line.costCenter ? `${line.costCenter.code} - ${line.costCenter.name}` : "-"}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{line.description || "-"}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        {entryStatus(entry) === "draft" && (
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

function buildAccountTree(flat: Account[]): (Account & { _children?: (Account & { _children?: unknown[] })[] })[] {
    const byId = new Map(flat.map((a) => [a.id, { ...a, _children: [] as (Account & { _children?: unknown[] })[] }]));
    const roots: (Account & { _children?: (Account & { _children?: unknown[] })[] })[] = [];
    for (const a of flat) {
        const node = byId.get(a.id)!;
        if (!a.parentId) {
            roots.push(node);
        } else {
            const parent = byId.get(a.parentId);
            if (parent && parent._children) parent._children.push(node);
        }
    }
    return roots;
}

export default function Accounting() {
    const navigate = useNavigate();
    const [tab, setTab] = useState<"accounts" | "journals" | "trial">("accounts");
    const [journalPage, setJournalPage] = useState(1);
    const [detailEntryId, setDetailEntryId] = useState<number | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
    const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
    const [formDialogOpen, setFormDialogOpen] = useState(false);
    const [ledgerAccount, setLedgerAccount] = useState<Account | null>(null);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editAccount, setEditAccount] = useState<Account | null>(null);
    const [profileAccount, setProfileAccount] = useState<Account | null>(null);
    const [accountSearch, setAccountSearch] = useState("");

    const { data: accountsData, isLoading: accountsLoading, refetch: refetchAccounts } = useAccounts();
    const { data: journalsData, isLoading: journalsLoading } = useJournalEntries({ page: journalPage, pageSize: 20 });
    const { data: trialData, isLoading: trialLoading } = useTrialBalance();
    const deleteAccountMutation = useDeleteAccount();

    const rawAccounts = Array.isArray(accountsData?.data)
        ? accountsData.data
        : Array.isArray(accountsData)
            ? accountsData
            : [];
    const accountTree = useMemo(() => buildAccountTree(rawAccounts), [rawAccounts]);

    // Search filter: find matching accounts + expand their ancestor chains
    const filteredTree = useMemo(() => {
        if (!accountSearch.trim()) return accountTree;
        const term = accountSearch.trim().toLowerCase();
        const matchIds = new Set<number>();
        const ancestorIds = new Set<number>();
        const byId = new Map<number, Account>(rawAccounts.map((a): [number, Account] => [a.id, a]));
        for (const a of rawAccounts) {
            if (a.code.toLowerCase().includes(term) || a.name.toLowerCase().includes(term) || (a.nameEn ?? "").toLowerCase().includes(term)) {
                matchIds.add(a.id);
                let pid = a.parentId;
                while (pid) {
                    ancestorIds.add(pid);
                    pid = byId.get(pid)?.parentId ?? null;
                }
            }
        }
        const keepIds = new Set([...matchIds, ...ancestorIds]);
        function filterNodes(nodes: typeof accountTree): typeof accountTree {
            return nodes
                .filter((n) => keepIds.has(n.id))
                .map((n) => ({ ...n, _children: n._children ? filterNodes(n._children as typeof accountTree) : [] }));
        }
        return filterNodes(accountTree);
    }, [accountTree, accountSearch, rawAccounts]);

    // Collect all group account IDs for expand-all
    const allGroupIds = useMemo(() => new Set(rawAccounts.filter((a) => a.isGroup).map((a) => a.id)), [rawAccounts]);

    const handleExpandAll = () => setExpandedIds(new Set(allGroupIds));
    const handleCollapseAll = () => setExpandedIds(new Set());

    const handleToggleExpand = (id: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleDeleteClick = async (account: Account) => {
        const canDelete = await accountingService.canDeleteAccount(account.id);
        if (!canDelete.canDelete) {
            if (canDelete.hasEntries) {
                toast({ variant: "destructive", title: "لا يمكن الحذف", description: "لا يمكن حذف الحساب لوجود قيود عليه" });
                return;
            }
            if (canDelete.hasChildren) {
                toast({ variant: "destructive", title: "لا يمكن الحذف", description: "يجب حذف الحسابات الفرعية أولاً" });
                return;
            }
        }
        setDeleteTarget(account);
    };

    const handleConfirmDelete = () => {
        if (deleteTarget) {
            deleteAccountMutation.mutate(deleteTarget.id, {
                onSettled: () => setDeleteTarget(null),
            });
        }
    };

    const handleAddAccount = () => {
        setFormMode("create");
        setEditAccount(null);
        setFormDialogOpen(true);
    };

    const handleEditAccount = (account: Account) => {
        setFormMode("edit");
        setEditAccount(account);
        setFormDialogOpen(true);
    };

    const handleViewAccount = (account: Account) => {
        setProfileAccount(account);
    };

    const handleViewLedger = (account: Account) => {
        setLedgerAccount(account);
    };

    const handleAccountCreated = (newAccount?: Account) => {
        if (!newAccount?.parentId) return;
        const byId = new Map<number, Account>(rawAccounts.map((a): [number, Account] => [a.id, a]));
        const idsToExpand = new Set<number>();
        let currentId: number | null = newAccount.parentId;
        while (currentId) {
            idsToExpand.add(currentId);
            currentId = byId.get(currentId)?.parentId ?? null;
        }
        setExpandedIds((prev) => {
            const next = new Set(prev);
            idsToExpand.forEach((id) => next.add(id));
            return next;
        });
    };

    const groupAccountsForParent = rawAccounts.filter((a) => a.isGroup);
    const journals = journalsData?.data || [];
    const journalPagination = journalsData?.pagination;
    const trialBalance = trialData || [];

    return (
        <div className="space-y-6" dir="rtl">
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
                        <div className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-lg font-semibold">دليل الحسابات</h2>
                            <Button onClick={handleAddAccount} className="gap-2">
                                <Plus className="w-4 h-4" />
                                إضافة حساب
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="بحث بالكود أو الاسم..."
                                    value={accountSearch}
                                    onChange={(e) => setAccountSearch(e.target.value)}
                                    className="pr-9"
                                />
                            </div>
                            <Button variant="outline" size="sm" onClick={handleExpandAll} title="فتح الكل">
                                <ChevronsUpDown className="w-4 h-4 ml-1" />
                                فتح الكل
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleCollapseAll} title="إغلاق الكل">
                                إغلاق الكل
                            </Button>
                        </div>
                        {accountsLoading ? (
                            <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                        ) : rawAccounts.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground"><p>لا توجد حسابات</p></div>
                        ) : filteredTree.length === 0 && accountSearch ? (
                            <div className="text-center py-12 text-muted-foreground"><p>لا توجد نتائج لـ "{accountSearch}"</p></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="data-table-header">
                                        <TableHead className="text-right">الرمز</TableHead>
                                        <TableHead className="text-right">اسم الحساب</TableHead>
                                        <TableHead className="text-center">النوع</TableHead>
                                        <TableHead className="text-center">التقرير</TableHead>
                                        <TableHead className="text-center">النوع</TableHead>
                                        <TableHead className="text-center">الحالة</TableHead>
                                        <TableHead className="text-center w-32">إجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTree.map((root) => (
                                        <AccountTreeRow
                                            key={root.id}
                                            account={root}
                                            expandedIds={accountSearch ? new Set([...expandedIds, ...allGroupIds]) : expandedIds}
                                            onToggle={handleToggleExpand}
                                            onView={handleViewAccount}
                                            onEdit={handleEditAccount}
                                            onDelete={handleDeleteClick}
                                        />
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
                            <div className="flex justify-between items-center p-4 border-b">
                                <h2 className="text-lg font-semibold">قيود اليومية</h2>
                                <Button onClick={() => navigate("/accounting/journal/new")} className="gap-2">
                                    <Plus className="w-4 h-4" />
                                    إضافة قيد
                                </Button>
                            </div>
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
                                                <TableCell className="text-center">{formatCurrency(entryTotalDebit(j))}</TableCell>
                                                <TableCell className="text-center">{formatCurrency(entryTotalCredit(j))}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        {entryStatus(j) === "posted" ? <StatusBadge status="success">مرحّل</StatusBadge> : <StatusBadge status="warning">مسودة</StatusBadge>}
                                                        {j.isReversed && <span className="text-xs text-amber-600">معكوس</span>}
                                                    </div>
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

            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>حذف الحساب</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل تريد حذف الحساب &quot;{deleteTarget?.name}&quot;؟ هذا الإجراء لا يمكن التراجع عنه.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            حذف
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AccountFormDialog
                open={formDialogOpen}
                onOpenChange={setFormDialogOpen}
                mode={formMode}
                account={editAccount}
                parentAccounts={groupAccountsForParent}
                onRefetch={async () => { await refetchAccounts(); }}
                onSuccess={handleAccountCreated}
            />

            <AccountProfileDialog
                open={!!profileAccount}
                onOpenChange={(open) => !open && setProfileAccount(null)}
                account={profileAccount}
                onEdit={handleEditAccount}
                onDelete={handleDeleteClick}
                onViewLedger={handleViewLedger}
            />

            <AccountLedgerDialog
                open={!!ledgerAccount}
                onOpenChange={(open) => !open && setLedgerAccount(null)}
                account={ledgerAccount}
            />
        </div>
    );
}
