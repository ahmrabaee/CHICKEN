import { BookOpen, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ROOT_TYPE_COLORS, REPORT_TYPE_LABELS } from "@/lib/accounting";
import type { Account } from "@/types/accounting";

interface AccountProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    account: Account | null;
    onEdit?: (account: Account) => void;
    onDelete?: (account: Account) => void;
    onViewLedger?: (account: Account) => void;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            <div className="text-sm font-medium">{value}</div>
        </div>
    );
}

export function AccountProfileDialog({
    open,
    onOpenChange,
    account,
    onEdit,
    onDelete,
    onViewLedger,
}: AccountProfileDialogProps) {
    if (!account) return null;

    const style = ROOT_TYPE_COLORS[account.rootType] || { bg: "", text: "", label: "—" };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle>تفاصيل الحساب</DialogTitle>
                    <DialogDescription className="sr-only">عرض تفاصيل الحساب المحاسبي</DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <Info label="كود الحساب" value={<span className="font-mono">{account.code}</span>} />
                        <Info label="اسم الحساب" value={account.name} />
                        <Info
                            label="النوع"
                            value={
                                <Badge variant="outline" className={`text-xs ${style.bg} ${style.text}`}>
                                    {style.label}
                                </Badge>
                            }
                        />
                        <Info label="نوع التقرير" value={REPORT_TYPE_LABELS[account.reportType] || account.reportType} />
                        <Info
                            label="نوع الحساب"
                            value={account.isGroup ? <Badge variant="secondary">مجموعة</Badge> : <Badge variant="outline">دفتر</Badge>}
                        />
                        <Info
                            label="الحالة"
                            value={
                                account.isActive ? (
                                    <StatusBadge status="success">نشط</StatusBadge>
                                ) : (
                                    <StatusBadge status="default">غير نشط</StatusBadge>
                                )
                            }
                        />
                        {account.parent && (
                            <Info label="الحساب الأب" value={`${account.parent.code} — ${account.parent.name}`} />
                        )}
                        {account.freezeAccount && (
                            <Info label="مجمد" value={<span className="text-amber-600">نعم</span>} />
                        )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t flex-wrap">
                        {onViewLedger && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => {
                                    onOpenChange(false);
                                    onViewLedger(account);
                                }}
                            >
                                <BookOpen className="w-4 h-4" />
                                كشف حساب
                            </Button>
                        )}
                        {onEdit && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => { onEdit(account); onOpenChange(false); }}
                            >
                                <Pencil className="w-4 h-4" />
                                تعديل
                            </Button>
                        )}
                        {onDelete && !account.isSystemAccount && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-destructive"
                                onClick={() => {
                                    onOpenChange(false);
                                    onDelete(account);
                                }}
                            >
                                <Trash2 className="w-4 h-4" />
                                حذف
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
