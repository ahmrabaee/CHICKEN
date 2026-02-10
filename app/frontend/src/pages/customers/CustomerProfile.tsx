import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import {
    ArrowRight,
    Save,
    X,
    Users,
    Building2,
    Phone,
    Mail,
    MapPin,
    CreditCard,
    Settings,
    Info,
    Trash2,
    Loader2,
    Crown,
    FileText,
    Hash,
    Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    useCustomer,
    useCreateCustomer,
    useUpdateCustomer,
    useDeleteCustomer,
} from "@/hooks/use-customers";
import { PriceLevel } from "@/types/customer";

// Zod schema for form validation
const customerSchema = z.object({
    name: z.string().min(2, "اسم العميل يجب أن يكون حرفين على الأقل"),
    nameEn: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    phone2: z.string().optional().or(z.literal("")),
    email: z.string().email("البريد الإلكتروني غير صحيح").optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
    creditLimit: z.coerce.number().min(0, "الحد الائتماني يجب أن يكون 0 أو أكثر").optional(),
    priceLevel: z.enum(["standard", "wholesale", "vip"]).optional(),
    defaultDiscountPct: z.coerce.number().min(0).max(10000, "النسبة يجب ألا تتجاوز 100%").optional(),
    taxNumber: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal("")),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

const priceLevelLabels: Record<PriceLevel, string> = {
    standard: "عادي",
    wholesale: "جملة",
    vip: "VIP",
};

/**
 * Format amount from minor units to display
 */
function formatAmount(amount: number): string {
    return (amount / 1000).toLocaleString("en-US", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    });
}

export default function CustomerProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id;
    const customerId = isEditing ? parseInt(id!) : 0;

    // Fetch existing customer data
    const { data: existingCustomer, isLoading: isFetching } = useCustomer(customerId);

    // Mutations
    const createMutation = useCreateCustomer();
    const updateMutation = useUpdateCustomer();
    const deleteMutation = useDeleteCustomer();

    // Form setup
    const form = useForm<CustomerFormValues>({
        resolver: zodResolver(customerSchema),
        defaultValues: {
            name: "",
            nameEn: "",
            phone: "",
            phone2: "",
            email: "",
            address: "",
            creditLimit: 0,
            priceLevel: "standard",
            defaultDiscountPct: 0,
            taxNumber: "",
            notes: "",
        },
    });

    // Populate form when editing
    useEffect(() => {
        if (existingCustomer) {
            form.reset({
                name: existingCustomer.name || "",
                nameEn: existingCustomer.nameEn || "",
                phone: existingCustomer.phone || "",
                phone2: existingCustomer.phone2 || "",
                email: existingCustomer.email || "",
                address: existingCustomer.address || "",
                creditLimit: existingCustomer.creditLimit || 0,
                priceLevel: (existingCustomer.priceLevel as PriceLevel) || "standard",
                defaultDiscountPct: existingCustomer.defaultDiscountPct || 0,
                taxNumber: existingCustomer.taxNumber || "",
                notes: existingCustomer.notes || "",
            });
        }
    }, [existingCustomer, form]);

    // Form submission
    const onSubmit = async (data: CustomerFormValues) => {
        try {
            // Clean empty strings to undefined
            const cleanData = {
                name: data.name,
                nameEn: data.nameEn || undefined,
                phone: data.phone || undefined,
                phone2: data.phone2 || undefined,
                email: data.email || undefined,
                address: data.address || undefined,
                creditLimit: data.creditLimit || 0,
                priceLevel: data.priceLevel as PriceLevel,
                defaultDiscountPct: data.defaultDiscountPct || 0,
                taxNumber: data.taxNumber || undefined,
                notes: data.notes || undefined,
            };

            if (isEditing) {
                await updateMutation.mutateAsync({
                    id: customerId,
                    data: cleanData,
                });
                toast.success("تم تحديث بيانات العميل بنجاح");
            } else {
                const newCustomer = await createMutation.mutateAsync(cleanData);
                toast.success("تم إنشاء العميل بنجاح");
                navigate(`/customers/${newCustomer.id}`);
            }
        } catch (error: any) {
            const errorMsg =
                error.response?.data?.messageAr ||
                error.response?.data?.message ||
                "حدث خطأ أثناء حفظ البيانات";
            toast.error(errorMsg);
        }
    };

    // Delete handler
    const handleDelete = async () => {
        if (!isEditing || !existingCustomer) return;
        if (!window.confirm(`هل أنت متأكد من حذف العميل "${existingCustomer.name}"؟`)) return;

        try {
            await deleteMutation.mutateAsync(customerId);
            toast.success("تم حذف العميل بنجاح");
            navigate("/customers");
        } catch (error: any) {
            const errorMsg =
                error.response?.data?.messageAr ||
                error.response?.data?.message ||
                "حدث خطأ أثناء حذف العميل";
            toast.error(errorMsg);
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    if (isEditing && isFetching) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20" dir="rtl">
            {/* Navigation & Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/customers")}
                        className="text-muted-foreground hover:text-primary gap-1"
                    >
                        العملاء
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                    <span className="text-muted-foreground">/</span>
                    <h1 className="text-xl font-bold">
                        {isEditing ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    {isEditing && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-rose-600 border-rose-200 hover:bg-rose-50"
                            onClick={handleDelete}
                        >
                            <Trash2 className="w-4 h-4 ml-2" />
                            حذف العميل
                        </Button>
                    )}
                    <Button
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={isSaving}
                        className="gap-2 min-w-[120px]"
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isEditing ? "حفظ التعديلات" : "إضافة العميل"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content Areas */}
                <div className="lg:col-span-2 space-y-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {/* Basic Information Section */}
                            <Card className="overflow-hidden border-t-4 border-t-emerald-600 shadow-sm border-none">
                                <div className="p-4 border-b bg-emerald-50/30 flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-slate-700">معلومات العميل الأساسية</h2>
                                        <p className="text-xs text-slate-500">أدخل البيانات الشخصية والمسميات</p>
                                    </div>
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>اسم العميل (عربي) *</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="مثال: أحمد محمد" {...field} />
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
                                                    <FormLabel>اسم العميل (English)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Example: Ahmed Mohammed"
                                                            className="font-english"
                                                            dir="ltr"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="phone"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>رقم الهاتف الأساسي</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                            <Input
                                                                placeholder="05X XXXXXXX"
                                                                className="pr-10 font-english text-right"
                                                                dir="ltr"
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
                                            name="phone2"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>رقم هاتف إضافي</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                            <Input
                                                                placeholder="05X XXXXXXX"
                                                                className="pr-10 font-english text-right"
                                                                dir="ltr"
                                                                {...field}
                                                            />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>البريد الإلكتروني</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                            <Input
                                                                placeholder="customer@example.com"
                                                                className="pr-10 font-english text-right"
                                                                dir="ltr"
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
                                            name="address"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>العنوان</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                            <Input placeholder="المدينة، الحي، الشارع" className="pr-10" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Financial & Settings Section */}
                            <Card className="border-t-4 border-t-teal-600 shadow-sm border-none">
                                <div className="p-4 border-b bg-teal-50/30 flex items-center gap-3">
                                    <div className="p-2 bg-teal-100 text-teal-600 rounded-lg">
                                        <CreditCard className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-slate-700">الإعدادات المالية</h2>
                                        <p className="text-xs text-slate-500">تحديد مستويات الأسعار والحدود الائتمانية</p>
                                    </div>
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="priceLevel"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>مستوى السعر</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="اختر المستوى" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent dir="rtl">
                                                            <SelectItem value="standard">عادي</SelectItem>
                                                            <SelectItem value="wholesale">جملة</SelectItem>
                                                            <SelectItem value="vip">
                                                                <div className="flex items-center gap-1">
                                                                    <Crown className="w-3 h-3 text-amber-500" />
                                                                    VIP
                                                                </div>
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="creditLimit"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>الحد الائتماني (₪)</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold font-mono">₪</span>
                                                            <Input type="number" placeholder="0.000" className="pl-8 text-left font-mono" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="defaultDiscountPct"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>نسبة الخصم الافتراضية (%)</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                            <Input type="number" placeholder="0" className="pl-10 text-left font-mono" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <Separator />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="taxNumber"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>الرقم الضريبي / رقم الهوية</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Hash className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                            <Input placeholder="أدخل الرقم الضريبي للعميل" className="pr-10 font-mono" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Additional Information Section */}
                            <Card className="border-t-4 border-t-amber-500 shadow-sm border-none">
                                <div className="p-4 border-b bg-amber-50/30 flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <h2 className="font-bold text-slate-700">ملاحظات إضافية</h2>
                                </div>
                                <CardContent className="p-6">
                                    <FormField
                                        control={form.control}
                                        name="notes"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="سجل أي ملاحظات خاصة بالعميل هنا..."
                                                        className="min-h-[100px] leading-relaxed"
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

                {/* Sidebar Info */}
                <div className="space-y-6">
                    {isEditing && existingCustomer && (
                        <>
                            {/* Status Card */}
                            <Card className="border-r-4 border-r-primary overflow-hidden shadow-sm border-none">
                                <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
                                    <h3 className="text-sm font-bold">حالة العميل</h3>
                                    <Badge variant={existingCustomer.isActive ? "default" : "secondary"}>
                                        {existingCustomer.isActive ? "نشط" : "غير نشط"}
                                    </Badge>
                                </div>
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">رقم العميل:</span>
                                        <span className="font-mono font-bold text-primary">{existingCustomer.customerNumber}</span>
                                    </div>
                                    <Separator />
                                    <div className="space-y-3 pt-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500">الرصيد المستحق:</span>
                                            <span className={`font-bold ${existingCustomer.currentBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                                {formatAmount(existingCustomer.currentBalance)}
                                                {existingCustomer.currentBalance === 0 && " ✓"}
                                            </span>
                                        </div>
                                        {existingCustomer.creditLimit > 0 && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">الحد الائتماني:</span>
                                                <span className="font-mono text-slate-700">
                                                    {formatAmount(existingCustomer.creditLimit)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Record History Card */}
                            <Card className="shadow-sm border-none">
                                <div className="p-4 border-b bg-slate-50/30 flex items-center gap-2">
                                    <Info className="w-4 h-4 text-slate-400" />
                                    <h3 className="text-sm font-bold">تاريخ السجل</h3>
                                </div>
                                <CardContent className="p-4 space-y-4 text-xs">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        <div>
                                            <p className="text-slate-500">تاريخ الإنشاء:</p>
                                            <p className="font-medium mt-0.5">
                                                {new Date(existingCustomer.createdAt).toLocaleString("ar-EG")}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                        <div>
                                            <p className="text-slate-500">آخر تحديث:</p>
                                            <p className="font-medium mt-0.5">
                                                {new Date(existingCustomer.updatedAt).toLocaleString("ar-EG")}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {!isEditing && (
                        <Card className="bg-slate-50 border-dashed shadow-sm border-none">
                            <CardContent className="p-6 text-center space-y-3">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-200 mx-auto shadow-sm">
                                    <Users className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold">ملف العميل</h3>
                                    <p className="text-xs text-slate-500 leading-relaxed px-4">
                                        سيتم تخصيص رمز فريد تلقائياً (CUST-XXXX) وإعداد رصيد ابتدائي بـ 0.000 عند الحفظ
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Help Section */}
                    <Card className="bg-blue-50/50 border-blue-100 shadow-sm border-none">
                        <CardContent className="p-6 space-y-3">
                            <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                نصائح سريعة
                            </h4>
                            <ul className="text-xs text-blue-800 space-y-2 pr-4 list-disc opacity-80 leading-relaxed">
                                <li>استخدم نظام VIP للعملاء المتميزين لتسهيل فلترة التقارير.</li>
                                <li>الرقم الضريبي مهم عند إصدار فواتير ضريبية قانونية.</li>
                                <li>الحد الائتماني يحمي النظام من تجاوز المديونيات المسموح بها.</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
