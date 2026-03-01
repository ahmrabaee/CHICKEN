import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    ChevronRight,
    Save,
    X,
    Building2,
    Phone,
    MapPin,
    Scale,
    Settings,
    Loader2,
    Trash2,
    Info,
    Users,
    Star,
    Package,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    useBranch,
    useCreateBranch,
    useUpdateBranch,
    useDeleteBranch,
    useActivateBranch,
} from "@/hooks/use-branches";
import { useAccounts } from "@/hooks/use-accounting";
import { CreateBranchDto, UpdateBranchDto } from "@/types/branch";
import { toast } from "sonner";

const branchSchema = z.object({
    code: z.string().min(2, "رمز الفرع مطلوب (2 أحرف على الأقل)").max(10, "الحد الأقصى 10 أحرف"),
    name: z.string().min(2, "اسم الفرع مطلوب"),
    nameEn: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    hasScale: z.boolean().default(false),
    scaleComPort: z.string().optional(),
    stockAccountId: z.string().optional(),
});

type BranchFormValues = z.infer<typeof branchSchema>;

const STOCK_ACCOUNT_CODES = ["1130", "1131", "1132", "1133", "1134", "1135"]; // مخزون فروع

export default function BranchProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id;

    const { data: existingBranch, isLoading: isLoadingBranch } = useBranch(parseInt(id || "0"));
    const { data: accountsData } = useAccounts();
    const allAccounts = accountsData?.data || [];
    const stockAccounts = allAccounts.filter(
        (a) => (STOCK_ACCOUNT_CODES.includes(a.code) || a.code.startsWith("113")) && !a.isGroup
    );
    const createMutation = useCreateBranch();
    const updateMutation = useUpdateBranch();
    const deleteMutation = useDeleteBranch();
    const activateMutation = useActivateBranch();

    const form = useForm<BranchFormValues>({
        resolver: zodResolver(branchSchema),
        defaultValues: {
            code: "",
            name: "",
            nameEn: "",
            address: "",
            phone: "",
            hasScale: false,
            scaleComPort: "",
            stockAccountId: "__none",
        },
    });

    useEffect(() => {
        if (existingBranch) {
            form.reset({
                code: existingBranch.code || "",
                name: existingBranch.name,
                nameEn: existingBranch.nameEn || "",
                address: existingBranch.address || "",
                phone: existingBranch.phone || "",
                hasScale: existingBranch.hasScale,
                scaleComPort: existingBranch.scaleComPort || "",
                stockAccountId: existingBranch.stockAccountId != null ? String(existingBranch.stockAccountId) : "__none",
            });
        }
    }, [existingBranch, form]);

    const hasScale = form.watch("hasScale");

    const onSubmit = async (values: BranchFormValues) => {
        try {
            // Validate scale COM port if hasScale is true
            if (values.hasScale && !values.scaleComPort) {
                toast.error("منفذ الميزان مطلوب عند تفعيل الميزان");
                return;
            }

            if (isEditing) {
                const updateData: UpdateBranchDto = {
                    name: values.name,
                    nameEn: values.nameEn || undefined,
                    address: values.address || undefined,
                    phone: values.phone || undefined,
                    hasScale: values.hasScale,
                    scaleComPort: values.scaleComPort || undefined,
                    stockAccountId: values.stockAccountId && values.stockAccountId !== "__none" ? parseInt(values.stockAccountId, 10) : null,
                };
                await updateMutation.mutateAsync({ id: parseInt(id!), data: updateData });
                toast.success("تم تحديث الفرع بنجاح");
            } else {
                const createData: CreateBranchDto = {
                    code: values.code.toUpperCase(),
                    name: values.name,
                    nameEn: values.nameEn?.trim() || undefined,
                    address: values.address?.trim() || undefined,
                    phone: values.phone?.trim() || undefined,
                    hasScale: values.hasScale,
                    ...(values.hasScale && values.scaleComPort && { scaleComPort: values.scaleComPort.trim() }),
                    ...(values.stockAccountId && values.stockAccountId !== "__none" && {
                        stockAccountId: parseInt(values.stockAccountId, 10),
                    }),
                };
                await createMutation.mutateAsync(createData);
                toast.success("تم إنشاء الفرع بنجاح");
            }
            navigate("/branches");
        } catch (error: any) {
            console.error("Failed to save branch:", error?.response?.data);
            const err = error.response?.data?.error;
            const details = Array.isArray(err?.details) ? err.details.join("; ") : null;
            const errorMsg = details || err?.message || err?.messageAr || "فشل حفظ البيانات";
            toast.error(errorMsg);
        }
    };

    const handleDelete = async () => {
        if (!existingBranch) return;

        try {
            await deleteMutation.mutateAsync(existingBranch.id);
            toast.success("تم إلغاء تفعيل الفرع بنجاح");
            navigate("/branches");
        } catch (error: any) {
            const errorMsg = error.response?.data?.messageAr || error.response?.data?.message || "لا يمكن إلغاء تفعيل هذا الفرع";
            toast.error(errorMsg);
        }
    };

    const handleActivate = async () => {
        if (!existingBranch) return;

        try {
            await activateMutation.mutateAsync(existingBranch.id);
            toast.success("تم تفعيل الفرع بنجاح");
        } catch (error: any) {
            const errorMsg = error.response?.data?.messageAr || error.response?.data?.message || "حدث خطأ أثناء تفعيل الفرع";
            toast.error(errorMsg);
        }
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    if (isEditing && isLoadingBranch) {
        return (
            <div className="flex h-[80dvh] items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-6 font-tajawal rtl pb-20"
        >
            {/* Premium Header Bar */}
            <div className="sticky top-0 z-20 flex items-center justify-between bg-white/80 backdrop-blur-md p-4 border-b shadow-sm -mx-6 px-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/branches")}>
                        <ChevronRight className="h-6 w-6" />
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold text-slate-800">
                            {isEditing ? `تعديل فرع: ${existingBranch?.name}` : "إضافة فرع جديد"}
                        </h1>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-mono">
                                {isEditing ? existingBranch?.code : "جديد"}
                            </Badge>
                            {isEditing && existingBranch?.isMainBranch && (
                                <Badge className="text-[10px] bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                                    <Star className="w-3 h-3 mr-1 fill-yellow-500" />
                                    الفرع الرئيسي
                                </Badge>
                            )}
                            {isEditing && !existingBranch?.isActive && (
                                <Badge variant="destructive" className="text-[10px]">
                                    غير نشط
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={() => navigate("/branches")}>
                        <X className="w-4 h-4 ml-2" />
                        إلغاء
                    </Button>
                    <Button
                        onClick={form.handleSubmit(onSubmit)}
                        className="gap-2 shadow-lg shadow-primary/20"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        حفظ البيانات
                    </Button>
                </div>
            </div>

            <Form {...form}>
                <form id="branch-form" className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto w-full">
                    {/* Left Column: Form Sections */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Basic Information Section */}
                        <Card className="border-none shadow-premium overflow-hidden transition-all hover:shadow-md">
                            <div className="bg-slate-50 border-b p-4 flex items-center gap-3">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <h2 className="font-bold text-slate-700">البيانات الأساسية للفرع</h2>
                            </div>
                            <CardContent className="p-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="code"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>رمز الفرع *</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="BR01"
                                                        {...field}
                                                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                                        disabled={isEditing}
                                                        className="font-mono text-left"
                                                        dir="ltr"
                                                    />
                                                </FormControl>
                                                {isEditing && (
                                                    <FormDescription>لا يمكن تغيير رمز الفرع</FormDescription>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>رقم الهاتف</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                        <Input
                                                            placeholder="+966501234567"
                                                            {...field}
                                                            className="pr-10 text-left"
                                                            dir="ltr"
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>اسم الفرع (العربية) *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="مثال: الفرع الرئيسي" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="nameEn"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>اسم الفرع (English)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Example: Main Branch"
                                                        {...field}
                                                        className="text-left"
                                                        dir="ltr"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="address"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>العنوان</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <Input
                                                        placeholder="شارع الملك فيصل، الرياض"
                                                        {...field}
                                                        className="pr-10"
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="stockAccountId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>حساب المخزون (Blueprint 06)</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value || "__none"}
                                            >
                                                <FormControl>
                                                    <SelectTrigger dir="rtl" className="font-arabic">
                                                        <SelectValue placeholder="اختر حساب المخزون (اختياري)" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent dir="rtl">
                                                    <SelectItem value="__none">— لا يوجد —</SelectItem>
                                                    {stockAccounts.map((acc) => (
                                                        <SelectItem key={acc.id} value={String(acc.id)}>
                                                            {acc.code} — {acc.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormDescription>حساب المخزون في الدفاتر لهذا الفرع (مثل 1130، 1131)</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Scale Configuration Section */}
                        <Card className="border-none shadow-premium overflow-hidden">
                            <div className="bg-slate-50 border-b p-4 flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                    <Scale className="w-5 h-5" />
                                </div>
                                <h2 className="font-bold text-slate-700">إعدادات الميزان الإلكتروني</h2>
                            </div>
                            <CardContent className="p-6 space-y-6">
                                <FormField
                                    control={form.control}
                                    name="hasScale"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-white shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">ميزان إلكتروني متصل</FormLabel>
                                                <FormDescription>
                                                    هل يحتوي هذا الفرع على ميزان إلكتروني متصل بالنظام؟
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                {hasScale && (
                                    <FormField
                                        control={form.control}
                                        name="scaleComPort"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>منفذ الميزان (COM Port) *</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="COM3"
                                                        {...field}
                                                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                                        className="font-mono text-left max-w-[200px]"
                                                        dir="ltr"
                                                    />
                                                </FormControl>
                                                <FormDescription>
                                                    منفذ الاتصال التسلسلي للميزان (مثال: COM1, COM3, COM10)
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Sidebar */}
                    <div className="space-y-6">
                        {/* Branch Status (Existing Branches Only) */}
                        {isEditing && existingBranch && (
                            <Card className="border-none shadow-premium overflow-hidden bg-white">
                                <div className="bg-slate-50 border-b p-4 font-bold flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-primary" />
                                    معلومات الفرع
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">الحالة</p>
                                            <Badge variant={existingBranch.isActive ? "default" : "secondary"}>
                                                {existingBranch.isActive ? "نشط" : "غير نشط"}
                                            </Badge>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">المستخدمين</p>
                                            <div className="flex items-center gap-1">
                                                <Users className="w-4 h-4 text-slate-400" />
                                                <span className="text-lg font-mono font-black text-slate-800">
                                                    {existingBranch.userCount || 0}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {existingBranch.stockAccount && (
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider flex items-center gap-1">
                                                <Package className="w-3 h-3" /> حساب المخزون
                                            </p>
                                            <span className="font-mono text-sm text-slate-800">
                                                {existingBranch.stockAccount.code} — {existingBranch.stockAccount.name}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-2 pt-2">
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-slate-400">تاريخ الإنشاء:</span>
                                            <span className="text-slate-600">
                                                {new Date(existingBranch.createdAt).toLocaleDateString("en-US")}
                                            </span>
                                        </div>
                                        {existingBranch.updatedAt && (
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-slate-400">آخر تحديث:</span>
                                                <span className="text-slate-600">
                                                    {new Date(existingBranch.updatedAt).toLocaleDateString("en-US")}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {!existingBranch.isActive && (
                                        <>
                                            <Separator />
                                            <Button
                                                variant="outline"
                                                type="button"
                                                className="w-full gap-2 border-green-200 hover:bg-green-50 text-green-600"
                                                onClick={handleActivate}
                                                disabled={activateMutation.isPending}
                                            >
                                                {activateMutation.isPending ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Building2 className="w-4 h-4" />
                                                )}
                                                إعادة تفعيل الفرع
                                            </Button>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Settings Card */}
                        <Card className="border-none shadow-premium sticky top-24 overflow-hidden bg-slate-50/50">
                            <div className="p-4 border-b font-bold flex items-center gap-2">
                                <Settings className="w-4 h-4 text-slate-500" />
                                ملاحظات
                            </div>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-slate-500 flex items-center gap-2">
                                        <Info className="w-4 h-4" />
                                        معلومات هامة
                                    </h4>
                                    <div className="text-xs text-slate-500 bg-white p-3 rounded-lg border border-dashed border-slate-200 leading-relaxed space-y-2">
                                        <p>• <strong>رمز الفرع:</strong> يجب أن يكون فريداً ولا يمكن تغييره بعد الإنشاء.</p>
                                        <p>• <strong>الفرع الرئيسي:</strong> لا يمكن حذفه أو إلغاء تفعيله.</p>
                                        <p>• <strong>الميزان:</strong> تأكد من إدخال منفذ COM الصحيح للميزان المتصل.</p>
                                    </div>
                                </div>

                                {isEditing && existingBranch && !existingBranch.isMainBranch && existingBranch.isActive && (
                                    <div className="pt-4 border-t">
                                        <Button
                                            variant="outline"
                                            type="button"
                                            className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-100 gap-2"
                                            onClick={handleDelete}
                                            disabled={deleteMutation.isPending}
                                        >
                                            {deleteMutation.isPending ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                            إلغاء تفعيل هذا الفرع
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </form>
            </Form>
        </motion.div>
    );
}
