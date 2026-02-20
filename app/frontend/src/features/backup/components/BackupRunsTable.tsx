import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2, XCircle, Loader2, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { BackupRun } from "../types";
import { backupApi } from "../api/backupApi";
import { toast } from "sonner";
import { useState } from "react";

interface Props {
    runs: BackupRun[];
    isLoading: boolean;
    onChanged?: () => Promise<void> | void;
}

export function BackupRunsTable({ runs, isLoading, onChanged }: Props) {
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [restoringId, setRestoringId] = useState<number | null>(null);

    const handleDownload = async (id: number) => {
        try {
            setDownloadingId(id);
            const { url } = await backupApi.createDownloadLink(id);

            // Use hidden link approach to trigger download
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', '');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            toast.error("فشل إنشاء رابط التحميل");
        } finally {
            setDownloadingId(null);
        }
    };

    const handleRestore = async (id: number) => {
        const confirmed = window.confirm("سيتم استبدال بيانات النظام الحالية بهذه النسخة. هل تريد المتابعة؟");
        if (!confirmed) return;

        try {
            setRestoringId(id);
            await backupApi.restoreBackup(id);
            toast.success("تمت استعادة النسخة الاحتياطية");
            await onChanged?.();
        } catch (error) {
            toast.error("فشل استعادة النسخة الاحتياطية");
        } finally {
            setRestoringId(null);
        }
    };

    const formatSize = (bytes: number | null) => {
        if (bytes === null) return "-";
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-right">التاريخ والوقت</TableHead>
                        <TableHead className="text-right">النوع</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">الحجم</TableHead>
                        <TableHead className="text-left">الإجراءات</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                            </TableCell>
                        </TableRow>
                    ) : runs.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                لا يوجد سجلات نسخ احتياطي بعد
                            </TableCell>
                        </TableRow>
                    ) : (
                        runs.map((run) => (
                            <TableRow key={run.id}>
                                <TableCell className="font-medium">
                                    {format(new Date(run.startedAt), "PPP p", { locale: ar })}
                                </TableCell>
                                <TableCell>
                                    {run.type === 'auto' ? 'تلقائي' : 'يدوي'}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {run.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                        {run.status === 'failed' && <XCircle className="w-4 h-4 text-destructive" />}
                                        {run.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                                        <span>
                                            {run.status === 'success' ? 'ناجح' :
                                                run.status === 'failed' ? 'فاشل' : 'جارٍ التنفيذ'}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>{formatSize(run.sizeBytes)}</TableCell>
                                <TableCell className="flex items-center gap-2">
                                    {run.status === 'success' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRestore(run.id)}
                                            disabled={restoringId === run.id}
                                            className="gap-2"
                                        >
                                            {restoringId === run.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <RotateCcw className="w-4 h-4" />
                                            )}
                                            استعادة
                                        </Button>
                                    )}
                                    {run.status === 'success' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDownload(run.id)}
                                            disabled={downloadingId === run.id}
                                            className="gap-2"
                                        >
                                            {downloadingId === run.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Download className="w-4 h-4" />
                                            )}
                                            تحميل
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
