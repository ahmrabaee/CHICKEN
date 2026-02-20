import { ChangeEvent, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  RefreshCcw,
  Clock,
  History,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Settings2,
  Upload,
} from "lucide-react";
import { useBackupConfig, useUpdateBackupConfig } from "../hooks/useBackupConfig";
import { useBackupStatus } from "../hooks/useBackupStatus";
import { useBackupRuns } from "../hooks/useBackupRuns";
import { BackupRunsTable } from "./BackupRunsTable";
import { backupApi } from "../api/backupApi";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";

export function BackupSettingsTab() {
  const queryClient = useQueryClient();
  const { data: config, isLoading: configLoading } = useBackupConfig();
  const { data: status, isLoading: statusLoading } = useBackupStatus();
  const { data: runs, isLoading: runsLoading, refetch: refetchRuns } = useBackupRuns({ page: 1, limit: 10 });
  const updateConfig = useUpdateBackupConfig();

  const [isTriggering, setIsTriggering] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const refreshBackupData = async () => {
    await Promise.all([
      refetchRuns(),
      queryClient.refetchQueries({ queryKey: ["backup", "status"] }),
    ]);
  };

  const handleToggleAuto = async (enabled: boolean) => {
    try {
      await updateConfig.mutateAsync({ auto_enabled: enabled });
      await queryClient.refetchQueries({ queryKey: ["backup", "status"] });
      toast.success(enabled ? "تم تفعيل النسخ التلقائي" : "تم إيقاف النسخ التلقائي");
    } catch {
      toast.error("فشل تحديث الإعدادات");
    }
  };

  const handleManualBackup = async () => {
    try {
      setIsTriggering(true);
      await backupApi.createManualBackup();
      await refreshBackupData();
      toast.success("بدأ النسخ الاحتياطي اليدوي");
    } catch {
      toast.error("فشل بدء النسخ الاحتياطي");
    } finally {
      setIsTriggering(false);
    }
  };

  const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const importResult = await backupApi.importBackup(file, { restoreAfterImport: true });

      if (importResult.restored) {
        toast.success("تم استيراد النسخة واستعادتها بنجاح");
      } else {
        toast.success("تم استيراد النسخة الاحتياطية");
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.messageAr ||
        error?.response?.data?.message ||
        "فشل استيراد النسخة الاحتياطية";
      toast.error(errorMessage);
    } finally {
      await refreshBackupData();
      setIsImporting(false);
      event.target.value = "";
    }
  };

  const isRunning = status?.running || isTriggering;
  const effectiveScheduleTime = status?.next_run_at
    ? format(new Date(status.next_run_at), "HH:mm", { locale: ar })
    : (config?.schedule_time || "02:00");

  return (
    <div className="space-y-6" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              إعدادات النسخ الاحتياطي
            </CardTitle>
            <CardDescription>تكوين النسخ التلقائي وجدولته</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">النسخ الاحتياطي التلقائي</Label>
                <p className="text-sm text-muted-foreground">تفعيل النسخ الاحتياطي اليومي لقاعدة البيانات والملفات</p>
              </div>
              <Switch
                checked={config?.auto_enabled || false}
                onCheckedChange={handleToggleAuto}
                disabled={configLoading || updateConfig.isPending}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 border flex items-center gap-3">
                <Clock className="w-8 h-8 text-primary/60" />
                <div>
                  <p className="text-xs text-muted-foreground">وقت النسخ</p>
                  <p className="font-bold">{effectiveScheduleTime}</p>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border flex items-center gap-3">
                <History className="w-8 h-8 text-primary/60" />
                <div>
                  <p className="text-xs text-muted-foreground">مدة الحفظ</p>
                  <p className="font-bold">{config?.retention_count || 15} يوم</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                يتم حذف النسخ الاحتياطية الأقدم من 15 يوماً تلقائياً من الخادم.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              حالة النظام
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">الحالة الحالية</p>
              <Badge variant={isRunning ? "default" : "secondary"} className="gap-1">
                {isRunning ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                {isRunning ? "جارٍ النسخ..." : "جاهز"}
              </Badge>
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  آخر نجاح
                </p>
                <p className="text-sm font-medium">
                  {status?.last_success_at ? format(new Date(status.last_success_at), "PP p", { locale: ar }) : "لا يوجد"}
                </p>
              </div>

              {status?.last_error && (
                <div>
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    آخر خطأ
                  </p>
                  <p className="text-xs text-destructive line-clamp-2" title={status.last_error}>
                    {status.last_error}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  النسخة القادمة
                </p>
                <p className="text-sm font-medium">
                  {status?.next_run_at ? format(new Date(status.next_run_at), "PP p", { locale: ar }) : "غير مجدول"}
                </p>
              </div>
            </div>

            <Button className="w-full gap-2 mt-4" onClick={handleManualBackup} disabled={isRunning || statusLoading}>
              {isRunning ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              بدء نسخ احتياطي الآن
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>سجل العمليات</CardTitle>
            <CardDescription>عرض وتصفح النسخ الاحتياطية السابقة</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".tar.gz,.tgz"
              className="hidden"
              onChange={handleImportBackup}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting}
              className="gap-2"
            >
              {isImporting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              استيراد نسخة
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <BackupRunsTable
            runs={runs?.items || []}
            isLoading={runsLoading}
            onChanged={refreshBackupData}
          />
        </CardContent>
      </Card>
    </div>
  );
}
