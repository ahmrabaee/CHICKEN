import { useState } from "react";
import { Loader2, Download } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAccountLedger } from "@/hooks/use-accounting";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { downloadReportPdf } from "@/services/pdf.service";
import { toast } from "@/hooks/use-toast";
import type { Account } from "@/types/accounting";

interface AccountLedgerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    account: Account | null;
}



export function AccountLedgerDialog({
    open,
    onOpenChange,
    account,
}: AccountLedgerDialogProps) {
    const currentYear = new Date().getFullYear();
    const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [pdfLoading, setPdfLoading] = useState(false);

    const handleDownloadLedgerPdf = async () => {
        if (!account?.code) return;
        setPdfLoading(true);
        try {
            await downloadReportPdf("ledger", {
                accountCode: account.code,
                startDate,
                endDate,
                language: "ar",
            });
            toast({ title: "تم التحميل", description: "تم تحميل كشف الحساب بنجاح" });
        } catch {
            toast({ variant: "destructive", title: "فشل التحميل", description: "تعذر تحميل ملف PDF" });
        } finally {
            setPdfLoading(false);
        }
    };

    const { data: ledgerEntries, isLoading } = useAccountLedger(
        account?.code || "",
        { startDate, endDate },
    );
    const entries = ledgerEntries || [];

    if (!account) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle>كشف حساب — {account.code} {account.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="flex gap-4 items-end flex-wrap">
                        <div className="space-y-2">
                            <Label>من تاريخ</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>إلى تاريخ</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={handleDownloadLedgerPdf}
                            disabled={pdfLoading}
                        >
                            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            تحميل PDF
                        </Button>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            لا توجد حركات في الفترة المحددة
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-auto max-h-[400px]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="text-right">التاريخ</TableHead>
                                        <TableHead className="text-right">رقم القيد</TableHead>
                                        <TableHead className="text-right">الوصف</TableHead>
                                        <TableHead className="text-center">مدين</TableHead>
                                        <TableHead className="text-center">دائن</TableHead>
                                        <TableHead className="text-center">الرصيد</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {entries.map((e, i) => (
                                        <TableRow key={e.id ?? i}>
                                            <TableCell className="text-sm">{formatDate(e.entryDate ?? "")}</TableCell>
                                            <TableCell className="font-mono text-sm">{e.entryNumber || "-"}</TableCell>
                                            <TableCell className="max-w-[200px] truncate">{e.description || "-"}</TableCell>
                                            <TableCell className="text-center">
                                                {e.debit > 0 ? formatCurrency(e.debit) : "-"}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {e.credit > 0 ? formatCurrency(e.credit) : "-"}
                                            </TableCell>
                                            <TableCell className="text-center font-medium">
                                                {formatCurrency(e.balance)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
