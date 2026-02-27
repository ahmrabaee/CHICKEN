
import React, { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    ChevronRight,
    Save,
    X,
    CreditCard,
    DollarSign,
    Info,
    Loader2,
    Calendar,
    Hash,
    User,
    ArrowLeftRight,
    FileText,
    Building2,
    ShieldCheck,
    Ban,
    Clock,
} from "lucide-react";
import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";

import { useRecordSalePayment, useRecordPurchasePayment, useCreateAdvancePayment, usePayment, useCancelPayment } from "@/hooks/use-payments";
import { useSales } from "@/hooks/use-sales";
import { usePurchases } from "@/hooks/use-purchases";
import { useCustomers } from "@/hooks/use-customers";
import { useSuppliers } from "@/hooks/use-suppliers";
import { toast } from "@/hooks/use-toast";
import { Payment } from "@/types/payments";
import { DocumentStatusBadge, CancelConfirmDialog } from "@/components/posting";

// ---------- helpers ----------
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
    mobile_payment: "دفع إلكتروني",
    check: "شيك",
};
const partyTypeLabels: Record<string, string> = {
    customer: "زبون",
    supplier: "مورد",
};
const refTypeLabels: Record<string, string> = {
    sale: "فاتورة مبيعات",
    purchase: "أمر شراء",
    advance: "دفعة مسبقة",
};

// ---------- zod schema (create only) ----------
const paymentSchema = z.object({
    paymentType: z.enum(["sale", "purchase", "advance"]),
    referenceId: z.coerce.number().optional(),
    partyType: z.enum(["customer", "supplier"]).optional(),
    partyId: z.coerce.number().optional(),
    amount: z.coerce.number().min(0.01, "المبلغ يجب أن يكون أكبر من صفر"),
    paymentMethod: z.string().min(1, "يجب اختيار طريقة الدفع"),
    paymentDate: z.string().min(1, "التاريخ مطلوب"),
    receiptNumber: z.string().optional(),
    notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

// ---------- InfoRow — reusable field display for view mode ----------
function InfoRow({ icon: Icon, label, value, highlight, mono }: {
    icon?: React.ElementType;
    label: string;
    value: React.ReactNode;
    highlight?: boolean;
    mono?: boolean;
}) {
    return (
        <div className="flex justify-between items-center py-2">
            <span className="text-sm text-slate-500 flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4" />}
                {label}
            </span>
            <span className={`text-sm font-medium ${highlight ? "text-primary text-base font-bold" : ""} ${mono ? "font-mono" : ""}`}>
                {value}
            </span>
        </div>
    );
}

// ========================================================================
// VIEW MODE — read-only detail layout for /payments/:id
// ========================================================================
function PaymentViewMode({ payment }: { payment: Payment }) {
    const navigate = useNavigate();
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const cancelPayment = useCancelPayment();
    const docstatus = payment.docstatus ?? (payment.isVoided ? 2 : 1);
    const canCancel = docstatus === 1 && !payment.isVoided;

    const handleCancelConfirm = (reason: string) => {
        cancelPayment.mutate(
            { id: payment.id, data: { reason } },
            { onSuccess: () => setShowCancelDialog(false) }
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6 pb-20 font-tajawal"
            dir="rtl"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/payments")}
                        className="text-muted-foreground hover:text-primary gap-1"
                    >
                        المدفوعات
                        <ChevronRight className="w-4 h-4 rotate-180" />
                    </Button>
                    <span className="text-muted-foreground">/</span>
                    <h1 className="text-xl font-bold">عرض دفعة</h1>
                </div>
                <div className="flex items-center gap-2 flex-row-reverse">
                    <DocumentStatusBadge docstatus={docstatus} isVoided={payment.isVoided} />
                    <Badge variant="outline" className="font-mono text-xs">
                        {payment.paymentNumber}
                    </Badge>
                    {canCancel && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowCancelDialog(true)}
                            className="gap-1"
                        >
                            <Ban className="w-3 h-3" />
                            إلغاء الدفعة
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Core Payment Info */}
                    <Card className="overflow-hidden border-t-4 border-t-emerald-600">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-emerald-600" />
                                بيانات الدفعة الأساسية
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <InfoRow icon={Hash} label="معرّف النظام" value={`#${payment.id}`} mono />
                            <Separator />
                            <InfoRow icon={Hash} label="رقم الدفعة" value={payment.paymentNumber} mono />
                            <Separator />
                            <InfoRow icon={Calendar} label="تاريخ الدفعة" value={formatDate(payment.paymentDate)} />
                            <Separator />
                            <InfoRow icon={DollarSign} label="المبلغ" value={formatCurrency(payment.amount)} highlight />
                            <Separator />
                            <InfoRow icon={CreditCard} label="طريقة الدفع" value={methodLabels[payment.paymentMethod] || payment.paymentMethod} />
                            <Separator />
                            <InfoRow
                                icon={payment.isVoided ? Ban : ShieldCheck}
                                label="الحالة"
                                value={<DocumentStatusBadge docstatus={docstatus} isVoided={payment.isVoided} />}
                            />
                        </CardContent>
                    </Card>

                    {/* Reference & Party */}
                    <Card className="overflow-hidden border-t-4 border-t-blue-600">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                                المرجع والطرف
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <InfoRow icon={FileText} label="نوع العملية" value={!payment.referenceType ? "دفعة مسبقة" : (refTypeLabels[payment.referenceType] || payment.referenceType)} />
                            <Separator />
                            <InfoRow icon={Hash} label="رقم المرجع (ID)" value={payment.referenceId != null ? `#${payment.referenceId}` : "—"} mono />
                            {payment.saleNumber && (
                                <>
                                    <Separator />
                                    <InfoRow label="رقم الفاتورة" value={payment.saleNumber} mono />
                                </>
                            )}
                            {payment.purchaseNumber && (
                                <>
                                    <Separator />
                                    <InfoRow label="رقم أمر الشراء" value={payment.purchaseNumber} mono />
                                </>
                            )}
                            <Separator />
                            <InfoRow icon={User} label="نوع الطرف" value={payment.partyType ? (partyTypeLabels[payment.partyType] || payment.partyType) : "—"} />
                            <Separator />
                            <InfoRow label="معرّف الطرف" value={payment.partyId ? `#${payment.partyId}` : "—"} mono />
                            <Separator />
                            <InfoRow label="اسم الطرف" value={payment.partyName || "—"} />
                        </CardContent>
                    </Card>

                    {/* Additional Details — always shown */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="w-5 h-5 text-slate-500" />
                                معلومات إضافية
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <InfoRow icon={Hash} label="رقم الإيصال" value={payment.receiptNumber || "—"} mono />
                            <Separator />
                            <InfoRow label="معرّف العملية البنكية" value={payment.bankTransactionId || "—"} mono />
                            <Separator />
                            <div className="pt-2">
                                <p className="text-xs text-slate-500 mb-2">ملاحظات</p>
                                <p className="text-sm bg-muted/30 rounded-lg p-3 leading-relaxed">
                                    {payment.notes || "—"}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Received By */}
                    {payment.receivedBy && (
                        <Card className="border-r-4 border-r-primary">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <User className="w-4 h-4 text-slate-400" />
                                    المسجّل
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">الاسم:</span>
                                    <span className="font-bold">{payment.receivedBy.fullName || payment.receivedBy.username}</span>
                                </div>
                                {payment.receivedBy.employeeNumber && (
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">رقم الموظف:</span>
                                        <span className="font-mono">{payment.receivedBy.employeeNumber}</span>
                                    </div>
                                )}
                                {payment.receivedBy.email && (
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">البريد:</span>
                                        <span className="font-mono text-xs" dir="ltr">{payment.receivedBy.email}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Branch — always shown */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-slate-400" />
                                الفرع
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {payment.branch ? (
                                <>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">اسم الفرع:</span>
                                        <span className="font-bold">{payment.branch.name}</span>
                                    </div>
                                    {payment.branch.nameEn && (
                                        <div className="flex justify-between items-center text-sm mt-2">
                                            <span className="text-slate-500">Name (EN):</span>
                                            <span>{payment.branch.nameEn}</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">اسم الفرع:</span>
                                        <span className="text-muted-foreground">—</span>
                                    </div>
                                    <p className="text-[11px] text-amber-600 mt-2 leading-relaxed">
                                        الفرع غير محدد — يتم تعيينه تلقائياً من الفاتورة/أمر الشراء.
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Timestamps */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                تاريخ السجل
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-xs">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <div>
                                    <p className="text-slate-500">تم الإنشاء في:</p>
                                    <p className="font-medium mt-0.5">{formatDateTime(payment.createdAt)}</p>
                                </div>
                            </div>
                            {payment.updatedAt !== payment.createdAt && (
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                    <div>
                                        <p className="text-slate-500">آخر تحديث:</p>
                                        <p className="font-medium mt-0.5">{formatDateTime(payment.updatedAt)}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Immutability Notice */}
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-3">
                        <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 leading-relaxed">
                            ⚠️ الدفعات المؤكدة لا يمكن تعديلها لضمان نزاهة السجلات المحاسبية.
                        </p>
                    </div>
                </div>
            </div>

            <CancelConfirmDialog
                open={showCancelDialog}
                onClose={() => setShowCancelDialog(false)}
                onConfirm={handleCancelConfirm}
                title="إلغاء الدفعة"
                entityLabel="الدفعة"
                glReversalNote={true}
                isPending={cancelPayment.isPending}
            />
        </motion.div>
    );
}

// ========================================================================
// CREATE MODE — form for /payments/new
// ========================================================================
export default function PaymentProfile() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const isEditing = !!id;

    const querySaleId = searchParams.get("saleId");
    const queryPurchaseId = searchParams.get("purchaseId");

    const recordSalePayment = useRecordSalePayment();
    const recordPurchasePayment = useRecordPurchasePayment();
    const createAdvancePayment = useCreateAdvancePayment();
    const { data: existingPayment, isLoading: isLoadingPayment } = usePayment(parseInt(id || "0"));

    const { data: salesData } = useSales({ pageSize: 500 });
    const { data: purchasesData } = usePurchases({ pageSize: 100 });
    const { data: customersData } = useCustomers({ pageSize: 500 });
    const { data: suppliersData } = useSuppliers({ pageSize: 500 });

    const form = useForm<PaymentFormValues>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            paymentType: queryPurchaseId ? "purchase" : querySaleId ? "sale" : "sale",
            referenceId: queryPurchaseId ? parseInt(queryPurchaseId) : querySaleId ? parseInt(querySaleId) : 0,
            partyType: "customer",
            partyId: 0,
            amount: 0,
            paymentMethod: "cash",
            paymentDate: new Date().toISOString().split("T")[0],
            receiptNumber: "",
            notes: "",
        },
    });

    const paymentType = form.watch("paymentType");
    const eligibleSales = (salesData?.data || []).filter(
        (s: any) => !s.isVoided && (s.totalAmount - s.amountPaid) > 0
    );
    const eligiblePurchases = (purchasesData?.data || []).filter(
        (p: any) => p.status !== "cancelled" && (p.grandTotal - p.amountPaid) > 0
    );

    useEffect(() => {
        if (paymentType === "advance") return;
        const refId = form.getValues("referenceId");
        if (paymentType === "sale" && eligibleSales.length > 0) {
            const valid = eligibleSales.some((s: any) => s.id === refId);
            if (!valid) form.setValue("referenceId", eligibleSales[0].id);
        } else if (paymentType === "purchase" && eligiblePurchases.length > 0) {
            const valid = eligiblePurchases.some((p: any) => p.id === refId);
            if (!valid) form.setValue("referenceId", eligiblePurchases[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentType, eligibleSales.length, eligiblePurchases.length]);

    const onSubmit = async (values: PaymentFormValues) => {
        const amountMinor = Math.round(values.amount * 100);

        if (values.paymentType === "advance") {
            const partyId = Number(values.partyId);
            const partyType = values.partyType as "customer" | "supplier";
            if (!partyId || !partyType) {
                toast({ variant: "destructive", title: "خطأ", description: "يجب اختيار الزبون أو المورد" });
                return;
            }
            try {
                await createAdvancePayment.mutateAsync({
                    partyType,
                    partyId,
                    amount: amountMinor,
                    paymentMethod: values.paymentMethod as any,
                    receiptNumber: values.receiptNumber,
                    notes: values.notes,
                    paymentDate: values.paymentDate,
                });
                navigate("/payments");
            } catch (error) {
                console.error("Failed to save advance payment:", error);
            }
            return;
        }

        const refId = Number(values.referenceId);
        if (!refId || refId < 1) {
            toast({
                variant: "destructive",
                title: "خطأ في البيانات",
                description: values.paymentType === "sale" ? "يجب اختيار فاتورة مبيعات صالحة" : "يجب اختيار أمر شراء صالح",
            });
            return;
        }
        if (values.paymentType === "sale" && !eligibleSales.some((s: any) => s.id === refId)) {
            toast({
                variant: "destructive",
                title: "الفاتورة غير موجودة",
                description: "الفاتورة المحددة غير موجودة أو لا تملك مبلغاً متبقياً. حدّث الصفحة واختر فاتورة صالحة.",
            });
            return;
        }
        if (values.paymentType === "purchase" && !eligiblePurchases.some((p: any) => p.id === refId)) {
            toast({
                variant: "destructive",
                title: "أمر الشراء غير موجود",
                description: "أمر الشراء المحدد غير موجود أو لا يملك مبلغاً متبقياً. حدّث الصفحة واختر أمراً صالحاً.",
            });
            return;
        }
        try {
            if (values.paymentType === "sale") {
                await recordSalePayment.mutateAsync({
                    saleId: refId,
                    amount: amountMinor,
                    paymentMethod: values.paymentMethod as any,
                    referenceNumber: values.receiptNumber,
                    notes: values.notes,
                });
            } else {
                await recordPurchasePayment.mutateAsync({
                    purchaseId: refId,
                    amount: amountMinor,
                    paymentMethod: values.paymentMethod,
                    referenceNumber: values.receiptNumber,
                    receiptNumber: values.receiptNumber,
                    paymentDate: values.paymentDate,
                    notes: values.notes,
                });
            }
            navigate("/payments");
        } catch (error) {
            console.error("Failed to save payment:", error);
        }
    };

    // Loading state for view mode
    if (isEditing && isLoadingPayment) {
        return (
            <div className="flex h-[80dvh] items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    // VIEW MODE — render read-only detail
    if (isEditing && existingPayment) {
        return <PaymentViewMode payment={existingPayment} />;
    }

    // CREATE MODE — render form
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6 pb-20 font-tajawal"
            dir="rtl"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/payments")}
                        className="text-muted-foreground hover:text-primary gap-1"
                    >
                        المدفوعات
                        <ChevronRight className="w-4 h-4 rotate-180" />
                    </Button>
                    <span className="text-muted-foreground">/</span>
                    <h1 className="text-xl font-bold">تسجيل دفعة جديدة</h1>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={() => navigate("/payments")}>
                        <X className="w-4 h-4 ml-2" />
                        إلغاء
                    </Button>
                    <Button
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={recordSalePayment.isPending || recordPurchasePayment.isPending || createAdvancePayment.isPending}
                        className="gap-2 shadow-lg shadow-primary/20"
                    >
                        {(recordSalePayment.isPending || recordPurchasePayment.isPending || createAdvancePayment.isPending) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        تأكيد وحفظ
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {/* Transaction Type & Reference */}
                            <Card className="overflow-hidden border-t-4 border-t-blue-600">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                                        نوع العملية والمرجع
                                    </CardTitle>
                                    <CardDescription>اختر نوع الدفعة ثم حدد الفاتورة أو أمر الشراء المرتبط</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="paymentType"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>نوع الدفعة *</FormLabel>
                                                    <Select
                                                        onValueChange={(val) => {
                                                            field.onChange(val);
                                                            form.setValue("referenceId", 0);
                                                        }}
                                                        value={field.value}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="اختر نوع الدفعة" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent dir="rtl">
                                                            <SelectItem value="sale">قبض من زبون (مبيعات)</SelectItem>
                                                            <SelectItem value="purchase">دفع لمورد (مشتريات)</SelectItem>
                                                            <SelectItem value="advance">دفعة مسبقة</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {paymentType === "advance" ? (
                                            <>
                                                <FormField
                                                    control={form.control}
                                                    name="partyType"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>نوع الطرف *</FormLabel>
                                                            <Select onValueChange={(v) => { field.onChange(v); form.setValue("partyId", 0); }} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent dir="rtl">
                                                                    <SelectItem value="customer">زبون</SelectItem>
                                                                    <SelectItem value="supplier">مورد</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="partyId"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{form.watch("partyType") === "supplier" ? "المورد *" : "الزبون *"}</FormLabel>
                                                            <Select
                                                                onValueChange={(v) => field.onChange(v ? Number(v) : 0)}
                                                                value={field.value ? String(field.value) : undefined}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={form.watch("partyType") === "supplier" ? "اختر المورد..." : "اختر الزبون..."} />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent dir="rtl">
                                                                    {form.watch("partyType") === "customer"
                                                                        ? (customersData?.data || []).map((c: { id: number; name: string }) => (
                                                                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                                                        ))
                                                                        : (suppliersData?.data || []).map((s: { id: number; name: string }) => (
                                                                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                                                        ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            </>
                                        ) : (
                                            <FormField
                                                control={form.control}
                                                name="referenceId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{paymentType === "sale" ? "فاتورة البيع *" : "أمر الشراء *"}</FormLabel>
                                                        <Select
                                                            onValueChange={(v) => field.onChange(v ? Number(v) : 0)}
                                                            value={field.value ? String(field.value) : undefined}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder={paymentType === "sale" ? "اختر فاتورة..." : "اختر أمر شراء..."} />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent dir="rtl">
                                                                {paymentType === "sale" ? (
                                                                    (() => {
                                                                        const eligibleSales = (salesData?.data || []).filter(
                                                                            (s: any) => !s.isVoided && (s.totalAmount - s.amountPaid) > 0
                                                                        );
                                                                        if (eligibleSales.length === 0) {
                                                                            return (
                                                                                <div className="px-2 py-4 text-center text-sm text-muted-foreground" dir="rtl">
                                                                                    لا توجد فواتير بمبلغ متبقٍ. أنشئ فاتورة من نقطة البيع أو المبيعات أولاً.
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return eligibleSales.map((s: any) => (
                                                                            <SelectItem key={s.id} value={s.id.toString()}>
                                                                                {s.saleNumber} - {s.customerName || "زبون"} (المتبقي: ₪{((s.totalAmount - s.amountPaid) / 100).toFixed(2)})
                                                                            </SelectItem>
                                                                        ));
                                                                    })()
                                                                ) : (
                                                                    (() => {
                                                                        const eligiblePurchases = (purchasesData?.data || []).filter(
                                                                            (p: any) => p.status !== "cancelled" && (p.grandTotal - p.amountPaid) > 0
                                                                        );
                                                                        if (eligiblePurchases.length === 0) {
                                                                            return (
                                                                                <div className="px-2 py-4 text-center text-sm text-muted-foreground" dir="rtl">
                                                                                    لا توجد أوامر شراء بمبلغ متبقٍ. أنشئ أمر شراء أولاً.
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return eligiblePurchases.map((p: any) => (
                                                                            <SelectItem key={p.id} value={p.id.toString()}>
                                                                                {p.purchaseNumber} - {p.supplierName} (المتبقي: ₪{((p.grandTotal - p.amountPaid) / 100).toFixed(2)})
                                                                            </SelectItem>
                                                                        ));
                                                                    })()
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                        {paymentType === "sale" && (!salesData?.data?.length || (salesData.data as any[]).filter((s: any) => !s.isVoided && (s.totalAmount - s.amountPaid) > 0).length === 0) && (
                                                            <p className="text-xs text-amber-600 mt-1">
                                                                لا توجد فواتير بمبلغ متبقٍ. <Button type="button" variant="link" className="p-0 h-auto text-xs" onClick={() => navigate("/sales/new")}>أنشئ فاتورة من نقطة البيع</Button> أو <Button type="button" variant="link" className="p-0 h-auto text-xs" onClick={() => navigate("/sales")}>المبيعات</Button> أولاً.
                                                            </p>
                                                        )}
                                                        {paymentType === "purchase" && (!purchasesData?.data?.length || (purchasesData.data as any[]).filter((p: any) => p.status !== "cancelled" && (p.grandTotal - p.amountPaid) > 0).length === 0) && (
                                                            <p className="text-xs text-amber-600 mt-1">
                                                                لا توجد أوامر شراء بمبلغ متبقٍ. <Button type="button" variant="link" className="p-0 h-auto text-xs" onClick={() => navigate("/purchasing")}>أنشئ أمر شراء</Button> أولاً.
                                                            </p>
                                                        )}
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Payment Details */}
                            <Card className="overflow-hidden border-t-4 border-t-emerald-600">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <DollarSign className="w-5 h-5 text-emerald-600" />
                                        بيانات الدفع
                                    </CardTitle>
                                    <CardDescription>حدد المبلغ وطريقة الدفع والتاريخ</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="amount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>المبلغ (NIS) *</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₪</span>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                className="pl-8 font-mono text-center text-lg font-bold"
                                                                {...field}
                                                            />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="paymentMethod"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>طريقة الدفع *</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent dir="rtl">
                                                            <SelectItem value="cash">نقدي</SelectItem>
                                                            <SelectItem value="card">بطاقة</SelectItem>
                                                            <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                                                            <SelectItem value="mobile_payment">دفع إلكتروني</SelectItem>
                                                            <SelectItem value="check">شيك</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="paymentDate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>تاريخ الدفعة *</FormLabel>
                                                    <FormControl>
                                                        <DatePicker
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            placeholder="اختر تاريخ الدفعة"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="receiptNumber"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>رقم الإيصال / المرجع (اختياري)</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                            <Input placeholder="رقم المرجع الخارجي..." className="pl-10 text-left" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="notes"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ملاحظات</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="أي تفاصيل إضافية..."
                                                        className="min-h-[100px]"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>
                        </form>
                    </Form>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Summary Card */}
                    <Card className="border-r-4 border-r-primary">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" />
                                ملخص العملية
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">الحالة:</span>
                                <Badge variant="secondary">مسودة</Badge>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">النوع:</span>
                                <span className="font-medium">{paymentType === "sale" ? "قبض (مبيعات)" : "دفع (مشتريات)"}</span>
                            </div>
                            <Separator />
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">إجمالي المبلغ</p>
                                <p className="text-2xl font-mono font-black text-slate-800">
                                    ₪{Number(form.watch("amount") || 0).toFixed(2)}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <p>سيتم تأكيد العملية وتحديث رصيد {paymentType === "sale" ? "الزبون" : "المورد"} فور الحفظ.</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* New Payment Info */}
                    <Card className="bg-slate-50 border-dashed">
                        <CardContent className="pt-6">
                            <div className="text-center space-y-3">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-200 mx-auto shadow-sm">
                                    <Info className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold">تسجيل دفعة جديدة</h3>
                                    <p className="text-xs text-slate-500 leading-relaxed px-4">
                                        سيقوم النظام تلقائياً بتوليد رقم دفعة فريد (مثال: PAY-000042) وربط الطرف والفرع من الفاتورة أو أمر الشراء.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Warning */}
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-3">
                        <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 leading-relaxed">
                            ⚠️ لا يمكن تعديل بيانات الدفعة بعد تأكيدها لضمان نزاهة السجلات المحاسبية والديون. يرجى مراجعة البيانات بدقة.
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
