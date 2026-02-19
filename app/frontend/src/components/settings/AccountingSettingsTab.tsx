import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsService } from "@/services/settings.service";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/hooks/use-accounting";
import { Account } from "@/types/accounting";

/**
 * Accounting Settings Tab - Blueprint 02 GL Engine, Blueprint 05 Tax Engine
 * Toggle GL Engine, Tax Engine, and view tolerance
 */
export function AccountingSettingsTab() {
    const queryClient = useQueryClient();
    const [glEngineEnabled, setGlEngineEnabled] = useState(false);
    const [taxEngineEnabled, setTaxEngineEnabled] = useState(false);

    const { data: settings, isLoading } = useQuery({
        queryKey: ["settings", "all"],
        queryFn: () => settingsService.getAll(),
    });

    const { data: accountsData } = useAccounts(true);
    const accounts = (accountsData?.data || accountsData || []) as Account[];

    const [roundOffAccountId, setRoundOffAccountId] = useState<string>("none");

    useEffect(() => {
        if (settings) {
            if ("gl_engine_enabled" in settings) {
                const val = settings.gl_engine_enabled;
                setGlEngineEnabled(val === true || val === "true");
            }
            if ("tax_engine_enabled" in settings) {
                const val = settings.tax_engine_enabled;
                setTaxEngineEnabled(val === true || val === "true");
            }
            if (settings.company && (settings.company as any).roundOffAccountId) {
                setRoundOffAccountId(String((settings.company as any).roundOffAccountId));
            }
        }
    }, [settings]);

    const updateSettingMutation = useMutation({
        mutationFn: ({ key, value }: { key: string; value: unknown }) =>
            settingsService.set(key, value),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["settings"] });
            toast.success("تم حفظ الإعداد بنجاح");
            if (variables.key === "gl_engine_enabled") {
                setGlEngineEnabled(variables.value === true || variables.value === "true");
            }
            if (variables.key === "tax_engine_enabled") {
                setTaxEngineEnabled(variables.value === true || variables.value === "true");
            }
        },
        onError: (error: unknown) => {
            const msg = (error as { response?: { data?: { messageAr?: string; message?: string } } })?.response?.data?.messageAr ||
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "فشل حفظ الإعداد";
            toast.error(msg);
        },
    });

    const handleGlEngineToggle = (checked: boolean) => {
        updateSettingMutation.mutate({ key: "gl_engine_enabled", value: checked });
    };

    const handleTaxEngineToggle = (checked: boolean) => {
        updateSettingMutation.mutate({ key: "tax_engine_enabled", value: checked ? "true" : "false" });
    };

    const updateCompanyMutation = useMutation({
        mutationFn: (data: any) => settingsService.updateCompany(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["settings"] });
            toast.success("تم تحديث بيانات الشركة بنجاح");
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.messageAr || "فشل تحديث بيانات الشركة");
        },
    });

    const handleRoundOffAccountChange = (value: string) => {
        const id = value === "none" ? null : parseInt(value);
        setRoundOffAccountId(value);
        updateCompanyMutation.mutate({ roundOffAccountId: id });
    };

    const tolerance = settings && "gl_debit_credit_tolerance" in settings
        ? Number(settings.gl_debit_credit_tolerance)
        : 5;

    return (
        <Card>
            <CardHeader>
                <CardTitle>إعدادات محرك القيود العامة (GL Engine)</CardTitle>
                <CardDescription>
                    Blueprint 02 — تفعيل محرك القيود الجديد مع دمج وتدوير تلقائي
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">تفعيل محرك القيود (GL Engine)</Label>
                                <p className="text-sm text-muted-foreground">
                                    عند التفعيل: استخدام مسار القيود الجديد مع الدمج والتسامح والتدوير التلقائي. عند التعطيل: المسار القديم.
                                </p>
                            </div>
                            <Switch
                                checked={glEngineEnabled}
                                onCheckedChange={handleGlEngineToggle}
                                disabled={updateSettingMutation.isPending}
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">تفعيل محرك الضرائب (Tax Engine)</Label>
                                <p className="text-sm text-muted-foreground">
                                    عند التفعيل: فصل الإيراد عن الضريبة، إنشاء قيود VAT Payable/Receivable منفصلة. Blueprint 05
                                </p>
                            </div>
                            <Switch
                                checked={taxEngineEnabled}
                                onCheckedChange={handleTaxEngineToggle}
                                disabled={updateSettingMutation.isPending}
                            />
                        </div>

                        <div className="rounded-lg border p-4 bg-muted/30 space-y-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                    <Label>حساب فرق التدوير (Round-off Account)</Label>
                                    <p className="text-xs text-muted-foreground">
                                        الحساب الذي ستُرحل إليه فروق العملات أو تدوير الأرقام (Blueprint 02).
                                    </p>
                                </div>
                                <div className="w-64">
                                    <Select
                                        value={roundOffAccountId}
                                        onValueChange={handleRoundOffAccountChange}
                                        disabled={updateCompanyMutation.isPending}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر حساب التدوير..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">غير محدد</SelectItem>
                                            {accounts.map((acc) => (
                                                <SelectItem key={acc.id} value={String(acc.id)}>
                                                    {acc.code} - {acc.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="pt-4 mt-4 border-t border-primary/10 space-y-2">
                                <Label className="text-sm font-semibold">تسامح التوازن</Label>
                                <p className="text-sm text-muted-foreground">
                                    القيمة الحالية: <strong className="text-foreground">{tolerance}</strong> وحدة صغيرة
                                    <span className="block text-xs mt-1">(مثلاً {tolerance} = {(tolerance / 100).toFixed(2)} ₪ عند precision=2)</span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    الفروق الصغيرة ضمن التسامح تُعالج تلقائياً بقيد تدوير.
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
