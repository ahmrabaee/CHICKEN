import React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    ArrowLeftRight,
    ChevronRight,
    FileText,
    Info,
    Loader2,
    Plus,
    Save,
    Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { useCreateJournalEntry, useAccounts } from "@/hooks/use-accounting";
import { toast } from "@/hooks/use-toast";
import type { Account, CreateJournalEntryDto, CreateJournalEntryLineDto } from "@/types/accounting";
import { cn } from "@/lib/utils";

// ---------- Helpers ----------
function formatCurrency(v: number) {
    return `₪ ${(v / 100).toFixed(2)}`;
}

const emptyLine: CreateJournalEntryLineDto = { accountId: 0, debit: 0, credit: 0 };

// ---------- Line Schema ----------
const lineSchema = z.object({
    accountId: z.coerce.number(),
    debit: z.coerce.number().min(0),
    credit: z.coerce.number().min(0),
});

const formSchema = z
    .object({
        description: z.string().min(1, "الوصف مطلوب"),
        entryDate: z.string().min(1, "التاريخ مطلوب"),
        lines: z.array(lineSchema),
    })
    .refine(
        (data) => {
            const valid = data.lines.filter(
                (l) => l.accountId && ((l.debit || 0) > 0 || (l.credit || 0) > 0)
            );
            const debit = valid.reduce((s, l) => s + (l.debit || 0), 0);
            const credit = valid.reduce((s, l) => s + (l.credit || 0), 0);
            return valid.length >= 2 && debit === credit && debit > 0;
        },
        { message: "القيد غير متوازن (يجب تساوي المدين والدائن مع سطرين على الأقل)" }
    );

type FormValues = z.infer<typeof formSchema>;

export default function JournalEntryProfile() {
    const navigate = useNavigate();
    const { data: accountsData } = useAccounts(true);
    const postableAccounts = (accountsData?.data || []) as Account[];
    const createMutation = useCreateJournalEntry();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            description: "",
            entryDate: new Date().toISOString().slice(0, 10),
            lines: [
                { ...emptyLine, accountId: 0 },
                { ...emptyLine, accountId: 0 },
            ],
        },
    });

    const lines = form.watch("lines");
    const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    const isBalanced = totalDebit === totalCredit && totalDebit > 0;
    const validLineCount = lines.filter(
        (l) => l.accountId && ((l.debit || 0) > 0 || (l.credit || 0) > 0)
    ).length;

    const addLine = () => {
        form.setValue("lines", [...lines, { ...emptyLine, accountId: 0 }]);
    };

    const removeLine = (idx: number) => {
        if (lines.length <= 2) return;
        form.setValue(
            "lines",
            lines.filter((_, i) => i !== idx)
        );
    };

    const handleSubmit = (values: FormValues) => {
        // Convert shekels to minor units (×100) per 01_REPORT_MONETARY_UNITS.md
        const validLines = values.lines
            .filter(
                (l) => l.accountId && ((l.debit || 0) > 0 || (l.credit || 0) > 0)
            )
            .map((l) => ({
                accountId: Number(l.accountId),
                debit: Math.round((Number(l.debit) || 0) * 100),
                credit: Math.round((Number(l.credit) || 0) * 100),
            }));

        const dto: CreateJournalEntryDto = {
            description: values.description || "قيد يدوي",
            entryDate: values.entryDate || undefined,
            lines: validLines,
        };

        createMutation.mutate(dto, {
            onSuccess: () => {
                toast({ title: "تم إنشاء القيد بنجاح" });
                navigate("/accounting");
            },
            onError: () => {
                toast({ variant: "destructive", title: "فشل إنشاء القيد" });
            },
        });
    };

    return (
        <div className="space-y-6 container max-w-7xl mx-auto py-8 px-4 font-tajawal" dir="rtl">
            {/* Breadcrumbs / Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div
                        className="flex items-center gap-2 text-slate-400 text-sm mb-2 group cursor-pointer"
                        onClick={() => navigate("/accounting")}
                    >
                        <span className="hover:text-primary transition-colors">المحاسبة</span>
                        <ChevronRight className="w-4 h-4" />
                        <span className="text-slate-600 font-bold">إضافة قيد جديد</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md bg-primary text-white">
                            <ArrowLeftRight className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                            إنشاء قيد يومية يدوي
                        </h1>
                    </div>
                </div>

                <Button
                    variant="outline"
                    onClick={() => navigate("/accounting")}
                    className="gap-2 text-slate-500"
                >
                    العودة للمحاسبة
                </Button>
            </div>

            <Separator className="bg-slate-200/60" />

            {/* Form */}
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(handleSubmit)}
                    className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                >
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Basic Info */}
                            <Card className="overflow-hidden border-t-4 border-t-primary shadow-sm border-none">
                                <div className="p-4 border-b bg-primary/5 flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-slate-700">البيانات الأساسية</h2>
                                        <p className="text-xs text-slate-500">وصف القيد وتاريخه</p>
                                    </div>
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>الوصف <span className="text-red-500">*</span></FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="وصف القيد"
                                                            className="bg-slate-50 border-slate-200"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="entryDate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>تاريخ القيد <span className="text-red-500">*</span></FormLabel>
                                                    <FormControl>
                                                        <DatePicker
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            placeholder="اختر تاريخ القيد"
                                                            className="bg-slate-50 border-slate-200"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Journal Lines */}
                            <Card className="overflow-hidden border-t-4 border-t-emerald-600 shadow-sm border-none">
                                <div className="p-4 border-b bg-emerald-50/30 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                            <ArrowLeftRight className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-700">أسطر القيد</h2>
                                            <p className="text-xs text-slate-500">الحساب، مدين، دائن — يجب توازن المدين والدائن</p>
                                        </div>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addLine}>
                                        <Plus className="w-3 h-3" />
                                        سطر
                                    </Button>
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    {lines.map((_, idx) => (
                                        <div key={idx} className="flex gap-2 items-start">
                                            <FormField
                                                control={form.control}
                                                name={`lines.${idx}.accountId`}
                                                render={({ field }) => (
                                                    <FormItem className="flex-1 min-w-0">
                                                        <FormLabel className="text-xs">الحساب</FormLabel>
                                                        <Select
                                                            value={field.value ? String(field.value) : ""}
                                                            onValueChange={(v) => field.onChange(Number(v))}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="bg-slate-50 border-slate-200 min-w-[200px]">
                                                                    <SelectValue placeholder="اختر الحساب" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent dir="rtl">
                                                                {postableAccounts.map((a) => (
                                                                    <SelectItem key={a.id} value={String(a.id)}>
                                                                        {a.code} — {a.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`lines.${idx}.debit`}
                                                render={({ field }) => (
                                                    <FormItem className="w-28">
                                                        <FormLabel className="text-xs">مدين</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min={0}
                                                                placeholder="0.00"
                                                                dir="ltr"
                                                                className="font-mono text-right"
                                                                value={field.value ? String((field.value as number) / 100) : ""}
                                                                onChange={(e) =>
                                                                    field.onChange(e.target.value ? Math.round(Number(e.target.value) * 100) : 0)
                                                                }
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`lines.${idx}.credit`}
                                                render={({ field }) => (
                                                    <FormItem className="w-28">
                                                        <FormLabel className="text-xs">دائن</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min={0}
                                                                placeholder="0.00"
                                                                dir="ltr"
                                                                className="font-mono text-right"
                                                                value={field.value ? String((field.value as number) / 100) : ""}
                                                                onChange={(e) =>
                                                                    field.onChange(e.target.value ? Math.round(Number(e.target.value) * 100) : 0)
                                                                }
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            {lines.length > 2 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="mt-8 text-destructive hover:text-destructive"
                                                    onClick={() => removeLine(idx)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    <div
                                        className={cn(
                                            "text-sm pt-2",
                                            isBalanced ? "text-emerald-600 font-medium" : "text-muted-foreground"
                                        )}
                                    >
                                        المدين: {(totalDebit || 0).toFixed(2)} ₪ — الدائن: {(totalCredit || 0).toFixed(2)} ₪
                                        {!isBalanced && validLineCount > 0 && (
                                            <span className="text-destructive mr-2"> — القيد غير متوازن</span>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            <Card className="shadow-lg border-none sticky top-24 overflow-hidden bg-slate-900 text-white">
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 opacity-90" />
                                <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

                                <CardHeader className="relative z-10 pb-0">
                                    <CardTitle className="text-sm font-bold text-slate-300 flex items-center gap-2 uppercase tracking-widest">
                                        <Info className="w-4 h-4" /> ملخص القيد
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="relative z-10 pt-6 space-y-6 font-tajawal">
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-sm text-slate-400">
                                            <span>إجمالي المدين</span>
                                            <span className="font-mono">₪ {(totalDebit || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-slate-400">
                                            <span>إجمالي الدائن</span>
                                            <span className="font-mono">₪ {(totalCredit || 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <Separator className="bg-slate-700/50" />
                                    <div className="flex justify-between items-end">
                                        <span className="text-lg font-bold text-slate-200">الحالة</span>
                                        <span
                                            className={cn(
                                                "text-xl font-bold font-mono",
                                                isBalanced ? "text-emerald-400" : "text-amber-400"
                                            )}
                                        >
                                            {isBalanced ? "متوازن ✓" : "غير متوازن"}
                                        </span>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full h-12 text-lg font-bold gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg mt-4 transition-all hover:scale-[1.02]"
                                        disabled={!isBalanced || createMutation.isPending}
                                    >
                                        {createMutation.isPending ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <Save className="w-5 h-5" />
                                        )}
                                        إنشاء القيد
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="w-full text-slate-400 hover:text-white hover:bg-slate-800"
                                        onClick={() => navigate("/accounting")}
                                    >
                                        إلغاء
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </form>
            </Form>
        </div>
    );
}
