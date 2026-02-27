
import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    ChevronRight,
    Save,
    X,
    DollarSign,
    Info,
    Loader2,
    Calendar,
    Hash,
    User,
    Building2,
    ShieldCheck,
    Clock,
    Tag,
    FileText,
    Percent,
    CreditCard,
    ArrowLeftRight,
} from "lucide-react";
import { motion } from "framer-motion";

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
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DocumentStatusBadge } from "@/components/posting";
import { Separator } from "@/components/ui/separator";

import { useExpense, useCreateExpense, useExpenseCategories } from "@/hooks/use-expenses";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useBranches } from "@/hooks/use-branches";
import { toast } from "@/hooks/use-toast";
import { CreateExpenseDto } from "@/types/expenses";

// ---------- Helpers ----------
function formatCurrency(v: number) {
    return `₪ ${(v / 100).toFixed(2)}`;
}
function formatDate(d: string) {
    return new Date(d).toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}
function formatDateTime(d: string) {
    return new Date(d).toLocaleString("ar-EG");
}

const methodLabels: Record<string, string> = {
    cash: "نقدي",
    card: "بطاقة",
    bank_transfer: "تحويل بنكي",
    check: "شيك",
};

// ---------- Zod Schema ----------
const expenseSchema = z.object({
    categoryId: z.coerce.number().min(1, "يجب اختيار التصنيف"),
    description: z.string().min(3, "الوصف يجب أن يكون 3 حروف على الأقل"),
    amount: z.coerce.number().min(0.01, "المبلغ يجب أن يكون أكبر من صفر"),
    taxAmount: z.coerce.number().default(0),
    expenseDate: z.string().min(1, "التاريخ مطلوب"),
    expenseType: z.string().default("operational"),
    supplierId: z.coerce.number().optional().or(z.literal(0)),
    paymentMethod: z.string().default("cash"),
    referenceNumber: z.string().optional(),
    branchId: z.coerce.number().optional().or(z.literal(0)),
    notes: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

// ---------- InfoRow ----------
function InfoRow({ icon: Icon, label, value, highlight, mono }: {
    icon: any;
    label: string;
    value: React.ReactNode;
    highlight?: boolean;
    mono?: boolean;
}) {
    return (
        <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0 group hover:bg-slate-50/50 transition-colors px-2 rounded-lg">
            <div className="mt-0.5 p-1.5 rounded-md bg-slate-100 text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all duration-300">
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-slate-400 mb-0.5 uppercase tracking-wider">{label}</p>
                <p className={cn(
                    "text-sm font-semibold truncate",
                    highlight ? "text-primary text-base" : "text-slate-700",
                    mono ? "font-mono tracking-tighter" : ""
                )}>
                    {value || "—"}
                </p>
            </div>
        </div>
    );
}

import { cn } from "@/lib/utils";

// ---------- VIEW MODE ----------
function ExpenseViewMode({ expense }: { expense: any }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="lg:col-span-2 space-y-6">
                <Card className="border-t-4 border-t-primary shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/50">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    تفاصيل المصروف {expense.expenseNumber}
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    البيانات الأساسية وتصنيف المصروف
                                </CardDescription>
                            </div>
                            <DocumentStatusBadge docstatus={expense.docstatus} isApproved={expense.isApproved} />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                            <InfoRow icon={Hash} label="معرّف النظام" value={`#${expense.id}`} mono />
                            <InfoRow icon={Calendar} label="تاريخ المصروف" value={formatDate(expense.expenseDate)} />
                            <InfoRow icon={Tag} label="فئة المصروف" value={expense.category?.name || "—"} />
                            <InfoRow icon={DollarSign} label="المبلغ الأساسي" value={formatCurrency(expense.amount)} highlight />
                            <InfoRow icon={Percent} label="مبلغ الضريبة" value={formatCurrency(expense.taxAmount || 0)} />
                            <InfoRow icon={CreditCard} label="طريقة الدفع" value={methodLabels[expense.paymentMethod] || expense.paymentMethod || "—"} />
                            <InfoRow icon={Hash} label="رقم المرجع / الإيصال" value={expense.referenceNumber || "—"} />
                            <InfoRow icon={Info} label="نوع المصروف" value={expense.expenseType || "—"} />
                        </div>

                        <div className="mt-8">
                            <h4 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-widest">
                                <FileText className="w-3 h-3" /> الوصف والملاحظات
                            </h4>
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="text-sm font-bold text-slate-800 mb-2">{expense.description}</p>
                                <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                                    {expense.notes || "لا توجد ملاحظات إضافية مسجلة لهذا المصروف."}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Registration Details */}
                <Card className="shadow-sm border-none bg-slate-50/50">
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
                            <div className="space-y-4">
                                <h4 className="font-bold text-slate-400 flex items-center gap-2 uppercase tracking-wider">
                                    <User className="w-3 h-3" /> سجل الإنشاء
                                </h4>
                                <div className="bg-white rounded-lg p-3 shadow-sm flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                        {(expense.createdBy?.fullName || "؟")[0]}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700">{expense.createdBy?.fullName || expense.createdByName || "غير معروف"}</p>
                                        <p className="text-slate-400 flex items-center gap-1 mt-0.5">
                                            <Clock className="w-3 h-3" /> {formatDateTime(expense.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {expense.isApproved && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-green-500 flex items-center gap-2 uppercase tracking-wider">
                                        <ShieldCheck className="w-3 h-3" /> سجل الاعتماد
                                    </h4>
                                    <div className="bg-white rounded-lg p-3 shadow-sm border border-green-100 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                                            {(expense.approvedBy?.fullName || "؟")[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-green-700">{expense.approvedBy?.fullName || "مشرف النظام"}</p>
                                            <p className="text-green-600/60 flex items-center gap-1 mt-0.5">
                                                <Clock className="w-3 h-3" /> {expense.approvedAt ? formatDateTime(expense.approvedAt) : "—"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                {/* Branch Info Card */}
                <Card className="shadow-sm overflow-hidden border-none group">
                    <div className="h-2 bg-amber-500" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-600">
                            <Building2 className="w-4 h-4 text-amber-500" /> الفرع المرتبط
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {expense.branch ? (
                            <div className="space-y-3 pt-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">اسم الفرع:</span>
                                    <span className="font-bold text-slate-900">{expense.branch.name}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">كود الفرع:</span>
                                    <Badge variant="outline" className="font-mono text-[10px]">{expense.branch.code}</Badge>
                                </div>
                            </div>
                        ) : (
                            <div className="pt-1">
                                <p className="text-sm font-bold text-slate-700">الفرع الرئيسي / عام</p>
                                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed italic">
                                    هذا المصروف غير مرتبط بفرع محدد، تم تسجيله تحت الحساب العام للمنشأة.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Supplier Info Card (Optional) */}
                {expense.supplier && (
                    <Card className="shadow-sm overflow-hidden border-none">
                        <div className="h-2 bg-blue-500" />
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-600">
                                <User className="w-4 h-4 text-blue-500" /> المورد المرتبط
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="pt-1 space-y-3 text-sm">
                                <div>
                                    <p className="font-bold text-slate-900">{expense.supplier.name}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{expense.supplier.supplierNumber}</p>
                                </div>
                                <Separator className="bg-slate-100" />
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">الضريبة:</span>
                                    <span className="text-muted-foreground">{expense.supplier.taxNumber || "—"}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}

// ---------- CREATE MODE ----------
function ExpenseCreateMode({ isSubmitting, onSubmit }: { isSubmitting: boolean; onSubmit: (values: ExpenseFormValues) => void }) {
    const { data: categories } = useExpenseCategories();
    const { data: suppliersData } = useSuppliers();
    const { data: branchesData } = useBranches();

    const form = useForm<ExpenseFormValues>({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            amount: 0,
            taxAmount: 0,
            paymentMethod: "cash",
            expenseDate: new Date().toISOString().split("T")[0],
            expenseType: "operational",
            description: "",
            referenceNumber: "",
            notes: "",
        },
    });

    const watchAmount = form.watch("amount");
    const watchTax = form.watch("taxAmount");
    const total = (Number(watchAmount) || 0) + (Number(watchTax) || 0);

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
                    {/* Main Content Areas */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* 1. Basic Information */}
                        <Card className="overflow-hidden border-t-4 border-t-primary shadow-sm border-none">
                            <div className="p-4 border-b bg-primary/5 flex items-center gap-3">
                                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-700">البيانات الأساسية</h2>
                                    <p className="text-xs text-slate-500">تصنيف المصروف وتاريخه ورقم المرجع</p>
                                </div>
                            </div>
                            <CardContent className="p-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="categoryId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>تصنيف المصروف <span className="text-red-500">*</span></FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-slate-50 border-slate-200">
                                                            <SelectValue placeholder="اختر الفئة..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent dir="rtl">
                                                        {categories?.map((c: any) => (
                                                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="expenseDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>تاريخ المصروف <span className="text-red-500">*</span></FormLabel>
                                                <FormControl>
                                                    <DatePicker
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        placeholder="اختر تاريخ المصروف"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="referenceNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>رقم المرجع / الإيصال</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Hash className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <Input placeholder="مثال: EXP-2024-001" {...field} className="pr-10 bg-slate-50 border-slate-200 font-mono" />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* 2. Financial Details */}
                        <Card className="overflow-hidden border-t-4 border-t-emerald-600 shadow-sm border-none">
                            <div className="p-4 border-b bg-emerald-50/30 flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-700">البيانات المالية</h2>
                                    <p className="text-xs text-slate-500">المبلغ، الضريبة، وطريقة الدفع</p>
                                </div>
                            </div>
                            <CardContent className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>المبلغ الأساسي (قبل الضريبة) <span className="text-red-500">*</span></FormLabel>
                                                <FormControl>
                                                    <div className="relative group">
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-sm">₪</span>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            {...field}
                                                            className="pr-8 bg-white border-emerald-200 h-12 text-lg font-bold text-emerald-700 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                                                            dir="ltr"
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="taxAmount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>مبلغ الضريبة (اختياري)</FormLabel>
                                                <FormControl>
                                                    <div className="relative group">
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₪</span>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            {...field}
                                                            className="pr-8 bg-slate-50 border-slate-200 h-12 font-mono"
                                                            dir="ltr"
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <Separator className="bg-slate-100" />

                                <FormField
                                    control={form.control}
                                    name="paymentMethod"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>طريقة الدفع</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-slate-50 border-slate-200">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent dir="rtl">
                                                    {Object.entries(methodLabels).map(([k, v]) => (
                                                        <SelectItem key={k} value={k}>{v}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* 3. Description & Notes */}
                        <Card className="overflow-hidden border-t-4 border-t-amber-500 shadow-sm border-none">
                            <div className="p-4 border-b bg-amber-50/30 flex items-center gap-3">
                                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-700">التفاصيل والملاحظات</h2>
                                    <p className="text-xs text-slate-500">وصف المصروف وأي ملاحظات إضافية</p>
                                </div>
                            </div>
                            <CardContent className="p-6 space-y-4">
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>الوصف / البيان <span className="text-red-500">*</span></FormLabel>
                                            <FormControl>
                                                <Input placeholder="وصف مختصر للمصروف..." {...field} className="bg-white border-amber-200" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ملاحظات إضافية</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    rows={3}
                                                    placeholder="تفاصيل إضافية..."
                                                    {...field}
                                                    className="bg-slate-50 border-slate-200 resize-none min-h-[100px]"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar Information */}
                    <div className="space-y-6 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
                        {/* Summary Card (Sticky) */}
                        <Card className="relative overflow-hidden border-none bg-slate-900 text-white shadow-lg">
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 opacity-90" />
                            <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

                            <CardHeader className="relative z-10 pb-0">
                                <CardTitle className="text-sm font-bold text-slate-300 flex items-center gap-2 uppercase tracking-widest">
                                    <Info className="w-4 h-4" /> ملخص العملية
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="relative z-10 pt-6 space-y-6 font-tajawal">
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-sm text-slate-400">
                                        <span>مجموع المبلغ</span>
                                        <span className="font-mono">{formatCurrency(watchAmount * 100 || 0)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm text-slate-400">
                                        <span>إجمالي الضريبة</span>
                                        <span className="font-mono">{formatCurrency(watchTax * 100 || 0)}</span>
                                    </div>
                                </div>
                                <Separator className="bg-slate-700/50" />
                                <div className="flex justify-between items-end">
                                    <span className="text-lg font-bold text-slate-200">الإجمالي النهائي</span>
                                    <span className="text-3xl font-black text-primary font-mono tracking-tight">
                                        {formatCurrency(total * 100 || 0)}
                                    </span>
                                </div>

                                <Button type="submit" className="w-full h-12 text-lg font-bold gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg mt-4 transition-all hover:scale-[1.02]" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    حفظ المصروف
                                </Button>
                                <Button type="button" variant="ghost" className="w-full text-slate-400 hover:text-white hover:bg-slate-800" onClick={() => window.history.back()}>
                                    إلغاء
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Relations Card */}
                        <Card className="shadow-sm border-none bg-slate-50/50">
                            <CardHeader className="pb-3 border-b border-dashed">
                                <CardTitle className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                    <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                                    ربط بجهات (اختياري)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <FormField
                                    control={form.control}
                                    name="supplierId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-slate-500">مورد مرتبط</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-white h-9 text-sm">
                                                        <SelectValue placeholder="اختر مورد..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent dir="rtl">
                                                    <SelectItem value="0">بدون مورد</SelectItem>
                                                    {suppliersData?.data?.map((s: any) => (
                                                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="branchId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-slate-500">فرع مرتبط</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-white h-9 text-sm">
                                                        <SelectValue placeholder="اختر فرع..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent dir="rtl">
                                                    <SelectItem value="0">الفرع الرئيسي / عام</SelectItem>
                                                    {branchesData?.map((b: any) => (
                                                        <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </Form>
    );
}

// ---------- MAIN COMPONENT ----------
export default function ExpenseProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = !id;

    const { data: expense, isLoading, error } = useExpense(Number(id));
    const createMutation = useCreateExpense();

    const handleSubmit = (values: ExpenseFormValues) => {
        const payload: CreateExpenseDto = {
            categoryId: values.categoryId,
            description: values.description,
            amount: Math.round(values.amount * 100),
            taxAmount: Math.round(values.taxAmount * 100),
            expenseDate: values.expenseDate,
            expenseType: values.expenseType,
            paymentMethod: values.paymentMethod,
            referenceNumber: values.referenceNumber || undefined,
            supplierId: values.supplierId ? Number(values.supplierId) : undefined,
            branchId: values.branchId ? Number(values.branchId) : undefined,
            notes: values.notes || undefined,
        };

        createMutation.mutate(payload, {
            onSuccess: (data) => {
                navigate(`/expenses`);
            },
        });
    };

    if (isLoading && !isNew) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-slate-500 font-bold animate-pulse">جاري تحميل بيانات المصروف...</p>
            </div>
        );
    }

    if (error && !isNew) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-6 text-center">
                <div className="p-4 bg-red-50 rounded-full">
                    <X className="w-12 h-12 text-red-500" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-800">عذراً، لم يتم العثور على المصروف</h3>
                    <p className="text-slate-500">المصروف الذي تبحث عنه قد يكون تم حذفه أو أن الرابط غير صحيح.</p>
                </div>
                <Button onClick={() => navigate("/expenses")} variant="outline" className="gap-2">
                    <ChevronRight className="w-4 h-4" /> العودة لقائمة المصروفات
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 container max-w-7xl mx-auto py-8 px-4 font-tajawal" dir="rtl">
            {/* Breadcrumbs / Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-2 group cursor-pointer" onClick={() => navigate("/expenses")}>
                        <span className="hover:text-primary transition-colors">المصروفات</span>
                        <ChevronRight className="w-4 h-4" />
                        <span className="text-slate-600 font-bold">{isNew ? "إضافة مصروف جديد" : `بروفايل المصروف #${id}`}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center shadow-md",
                            isNew ? "bg-primary text-white" : "bg-white text-primary"
                        )}>
                            {isNew ? <DollarSign className="w-6 h-6 text-white" /> : <Hash className="w-6 h-6" />}
                        </div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                            {isNew ? "تسجيل مصروف جديد" : `المصروف ${expense?.expenseNumber}`}
                        </h1>
                    </div>
                </div>

                {!isNew && (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => navigate("/expenses")} className="gap-2 text-slate-500">
                            العودة للقائمة
                        </Button>
                    </div>
                )}
            </div>

            <Separator className="bg-slate-200/60" />

            {/* Content Area */}
            {isNew ? (
                <ExpenseCreateMode
                    isSubmitting={createMutation.isPending}
                    onSubmit={handleSubmit}
                />
            ) : (
                <ExpenseViewMode expense={expense} />
            )}
        </div>
    );
}
