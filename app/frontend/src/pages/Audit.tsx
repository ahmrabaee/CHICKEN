import { useState } from "react";
import { Search, Loader2, Eye } from "lucide-react";
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
import { useAuditLogs } from "@/hooks/use-audit";
import { AuditLog } from "@/types/audit";
import {
    actionLabels, entityLabels, getActionLabel, getEntityLabel, isEnglishString
} from "@/constants/auditLogLabels";

function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function renderMappedValue(raw: string, mapped: string) {
    if (raw === mapped && isEnglishString(raw)) {
        return <span dir="ltr" className="inline-block text-right">{raw}</span>;
    }
    return mapped;
}

function AuditDetailDialog({ log, open, onClose }: { log: AuditLog; open: boolean; onClose: () => void }) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto" dir="rtl">
                <DialogHeader><DialogTitle className="text-xl font-bold">تفاصيل سجل المراجعة</DialogTitle></DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Info label="المستخدم" value={log.userName || `#${log.userId}`} />
                        <Info label="الإجراء" value={renderMappedValue(log.action, getActionLabel(log.action))} />
                        <Info label="الكيان" value={renderMappedValue(log.entityType, getEntityLabel(log.entityType))} />
                        {log.entityId && <Info label="رقم الكيان" value={`#${log.entityId}`} />}
                        <Info label="التوقيت" value={formatDate(log.createdAt)} />
                        {log.ipAddress && <Info label="العنوان IP" value={log.ipAddress} />}
                    </div>
                    {log.oldValues && (
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">القيم السابقة</p>
                            <pre className="text-xs bg-red-50 dark:bg-red-950 p-3 rounded-lg overflow-auto max-h-[200px]" dir="ltr">
                                {JSON.stringify(log.oldValues, null, 2)}
                            </pre>
                        </div>
                    )}
                    {log.newValues && (
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">القيم الجديدة</p>
                            <pre className="text-xs bg-green-50 dark:bg-green-950 p-3 rounded-lg overflow-auto max-h-[200px]" dir="ltr">
                                {JSON.stringify(log.newValues, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
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

export default function Audit() {
    const [searchQuery, setSearchQuery] = useState("");
    const [actionFilter, setActionFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

    const queryParams = {
        page, pageSize: 30,
        ...(actionFilter !== "all" ? { action: actionFilter } : {}),
    };

    const { data, isLoading, error } = useAuditLogs(queryParams);
    const logs = data?.data || [];
    const pagination = data?.pagination;

    const filtered = logs.filter((l: AuditLog) => {
        if (!searchQuery) return true;
        return (
            (l.userName || "").includes(searchQuery) ||
            l.action.includes(searchQuery.toLowerCase()) ||
            l.entityType.includes(searchQuery.toLowerCase())
        );
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">سجل المراجعة</h1>
                <p className="text-muted-foreground mt-1">متابعة جميع العمليات والتغييرات</p>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
                        </div>
                        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                            <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="الإجراء" /></SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all">الكل</SelectItem>
                                {Object.entries(actionLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : error ? (
                        <div className="text-center py-16 text-red-500"><p>حدث خطأ</p></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground"><p className="text-lg">لا توجد سجلات</p></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="data-table-header">
                                    <TableHead className="text-right">المستخدم</TableHead>
                                    <TableHead className="text-center">الإجراء</TableHead>
                                    <TableHead className="text-center">الكيان</TableHead>
                                    <TableHead className="text-center">الرقم</TableHead>
                                    <TableHead className="text-center">التوقيت</TableHead>
                                    <TableHead className="text-center w-16">عرض</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((l: AuditLog) => (
                                    <TableRow key={l.id} className="data-table-row">
                                        <TableCell className="font-medium">{l.userName || `#${l.userId}`}</TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-sm px-2 py-1 rounded-md bg-muted/50 text-foreground">
                                                {renderMappedValue(l.action, getActionLabel(l.action))}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-sm px-2 py-1 rounded-md bg-muted/50 text-foreground">
                                                {renderMappedValue(l.entityType, getEntityLabel(l.entityType))}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center text-sm text-muted-foreground font-mono">{l.entityId || "-"}</TableCell>
                                        <TableCell className="text-center text-sm text-muted-foreground">{formatDate(l.createdAt)}</TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailLog(l)}>
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
                <p className="text-sm text-muted-foreground">{pagination ? `صفحة ${pagination.page} من ${pagination.totalPages}` : `${filtered.length} سجل`}</p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={!pagination?.hasPrev} onClick={() => setPage(p => Math.max(1, p - 1))}>السابق</Button>
                    <Button variant="outline" size="sm" disabled={!pagination?.hasNext} onClick={() => setPage(p => p + 1)}>التالي</Button>
                </div>
            </div>

            {detailLog && <AuditDetailDialog log={detailLog} open={!!detailLog} onClose={() => setDetailLog(null)} />}
        </div>
    );
}
