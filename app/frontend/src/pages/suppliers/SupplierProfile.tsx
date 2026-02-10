import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    ChevronRight,
    Save,
    Loader2,
    Building2,
    Phone,
    Mail,
    MapPin,
    CreditCard,
    Briefcase,
    Star,
    FileText,
    AlertCircle,
    Hash,
    Info,
    History,
    Trash2,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    useSupplier,
    useCreateSupplier,
    useUpdateSupplier,
    useDeleteSupplier,
} from "@/hooks/use-suppliers";
import { CreateSupplierDto } from "@/types/supplier";

/**
 * Build API payload: only send optional fields when they have values.
 * Backend ValidationPipe + @IsEmail() fail on empty string for email;
 * omit empty strings so optional validators are skipped.
 */
function toCreateSupplierDto(values: SupplierFormValues): CreateSupplierDto {
    const dto: CreateSupplierDto = { name: values.name.trim() };
    if (values.nameEn?.trim()) dto.nameEn = values.nameEn.trim();
    if (values.contactPerson?.trim()) dto.contactPerson = values.contactPerson.trim();
    if (values.phone?.trim()) dto.phone = values.phone.trim();
    if (values.email?.trim()) dto.email = values.email.trim();
    if (values.address?.trim()) dto.address = values.address.trim();
    if (values.paymentTerms?.trim()) dto.paymentTerms = values.paymentTerms.trim();
    if (values.taxNumber?.trim()) dto.taxNumber = values.taxNumber.trim();
    if (values.bankName?.trim()) dto.bankName = values.bankName.trim();
    if (values.bankAccountNumber?.trim()) dto.bankAccountNumber = values.bankAccountNumber.trim();
    if (values.notes?.trim()) dto.notes = values.notes.trim();
    if (values.creditLimit != null) dto.creditLimit = Number(values.creditLimit);
    if (values.rating != null) dto.rating = Number(values.rating);
    return dto;
}

// Zod schema for form validation
// Included all 13 editable fields from Prisma model
const supplierSchema = z.object({
    name: z.string().min(2, "اسم التاجر يجب أن يكون حرفين على الأقل"),
    nameEn: z.string().optional().or(z.literal("")),
    contactPerson: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    email: z.string().email("البريد الإلكتروني غير صحيح").optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
    paymentTerms: z.string().optional().or(z.literal("")),
    taxNumber: z.string().optional().or(z.literal("")),
    creditLimit: z.coerce.number().min(0, "الحد الائتماني يجب أن يكون 0 أو أكثر").optional().or(z.literal(0)),
    bankName: z.string().optional().or(z.literal("")),
    bankAccountNumber: z.string().optional().or(z.literal("")),
    rating: z.coerce.number().min(0).max(5).optional().or(z.literal(0)),
    notes: z.string().optional().or(z.literal("")),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

/**
 * Format amount from minor units to display
 */
function formatAmount(amount: number): string {
    return (amount / 1000).toLocaleString("en-US", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    });
}

export default function SupplierProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;
    const supplierId = isEditMode ? parseInt(id) : 0;

    // Data fetching & Mutations
    const { data: existingSupplier, isLoading: isFetching } = useSupplier(supplierId);
    const createMutation = useCreateSupplier();
    const updateMutation = useUpdateSupplier();
    const deleteMutation = useDeleteSupplier();

    // Form initialization
    const form = useForm<SupplierFormValues>({
        resolver: zodResolver(supplierSchema),
        defaultValues: {
            name: "",
            nameEn: "",
            contactPerson: "",
            phone: "",
            email: "",
            address: "",
            paymentTerms: "",
            taxNumber: "",
            creditLimit: 0,
            bankName: "",
            bankAccountNumber: "",
            rating: 0,
            notes: "",
        },
    });

    // Populate form with existing data when in edit mode
    useEffect(() => {
        if (existingSupplier) {
            form.reset({
                name: existingSupplier.name,
                nameEn: existingSupplier.nameEn || "",
                contactPerson: existingSupplier.contactPerson || "",
                phone: existingSupplier.phone || "",
                email: existingSupplier.email || "",
                address: existingSupplier.address || "",
                paymentTerms: existingSupplier.paymentTerms || "",
                taxNumber: existingSupplier.taxNumber || "",
                creditLimit: existingSupplier.creditLimit || 0,
                bankName: existingSupplier.bankName || "",
                bankAccountNumber: existingSupplier.bankAccountNumber || "",
                rating: existingSupplier.rating || 0,
                notes: existingSupplier.notes || "",
            });
        }
    }, [existingSupplier, form]);

    // Form submission
    const onSubmit = async (values: SupplierFormValues) => {
        try {
            if (isEditMode) {
                await updateMutation.mutateAsync({
                    id: supplierId,
                    data: toCreateSupplierDto(values),
                });
                toast.success("تم تحديث بيانات التاجر بنجاح");
            } else {
                const newSupplier = await createMutation.mutateAsync(toCreateSupplierDto(values));
                toast.success("تم إضافة التاجر بنجاح");
                navigate("/traders");
            }
        } catch (error: any) {
            const errorMsg =
                error.response?.data?.messageAr ||
                error.response?.data?.message ||
                "حدث خطأ أثناء حفظ البيانات";
            toast.error(errorMsg);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`هل أنت متأكد من حذف المورد "${existingSupplier?.name}"؟`)) return;

        try {
            await deleteMutation.mutateAsync(supplierId);
            toast.success("تم حذف المورد بنجاح");
            navigate("/traders");
        } catch (error: any) {
            const errorMsg =
                error.response?.data?.messageAr ||
                error.response?.data?.message ||
                "حدث خطأ أثناء حذف المورد";
            toast.error(errorMsg);
        }
    };

    if (isEditMode && isFetching) {
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
                        onClick={() => navigate("/traders")}
                        className="text-muted-foreground hover:text-primary gap-1"
                    >
                        التجار
                        <ChevronRight className="w-4 h-4 rotate-180" />
                    </Button>
                    <span className="text-muted-foreground">/</span>
                    <h1 className="text-xl font-bold">
                        {isEditMode ? "تعديل بيانات تاجر" : "إضافة تاجر جديد"}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    {isEditMode && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-rose-600 border-rose-200 hover:bg-rose-50"
                            onClick={handleDelete}
                        >
                            <Trash2 className="w-4 h-4 ml-2" />
                            حذف المورد
                        </Button>
                    )}
                    <Button
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={createMutation.isPending || updateMutation.isPending}
                        className="gap-2"
                    >
                        {createMutation.isPending || updateMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isEditMode ? "حفظ التعديلات" : "إضافة التاجر"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content Areas */}
                <div className="lg:col-span-2 space-y-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {/* Basic Information */}
                            <Card className="overflow-hidden border-t-4 border-t-emerald-600">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-emerald-600" />
                                        المعلومات الأساسية
                                    </CardTitle>
                                    <CardDescription>أدخل البيانات الأساسية للتاجر أو المورد</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>اسم التاجر (عربي)</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="مثال: مزرعة الخير" {...field} />
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
                                                    <FormLabel>اسم التاجر (English)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Example: Al Khair Farm"
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
                                            name="contactPerson"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>الشخص المسؤول</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Briefcase className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                            <Input placeholder="اسم صاحب المزرعة أو المندوب" className="pr-10" {...field} />
                                                        </div>
                                                    </FormControl>
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
                                                            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                            <Input
                                                                placeholder="059 XXXXXXX"
                                                                className="pr-10 font-english"
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
                                                                placeholder="supplier@example.com"
                                                                className="pr-10 font-english"
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
                                                            <Input placeholder="المدينة، المنطقة، الشارع" className="pr-10" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Financial & Banking Settings */}
                            <Card className="border-t-4 border-t-teal-600">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <CreditCard className="w-5 h-5 text-teal-600" />
                                        الإعدادات المالية والبنكية
                                    </CardTitle>
                                    <CardDescription>تحديد شروط الدفع والبيانات الضريبية والبنكية</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="paymentTerms"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>شروط الدفع</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="اختر شرط الدفع" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent dir="rtl">
                                                            <SelectItem value="cash">نقداً عند الاستلام</SelectItem>
                                                            <SelectItem value="net_7">صافي 7 أيام</SelectItem>
                                                            <SelectItem value="net_15">صافي 15 يوم</SelectItem>
                                                            <SelectItem value="net_30">صافي 30 يوم</SelectItem>
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
                                                    <FormDescription className="text-xs">سيتم ضرب القيمة في 1000 داخلياً لعرضها بالمليم</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <Separator />

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="taxNumber"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>الرقم الضريبي</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Hash className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                            <Input placeholder="رقم المشتغل المرخص" className="pr-10 font-mono" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="bankName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>اسم البنك</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="مثال: بنك فلسطين" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="bankAccountNumber"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>رقم الحساب</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="IBAN or Account Number" className="font-mono text-left" dir="ltr" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Rating & Notes */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Star className="w-5 h-5 text-amber-500" />
                                        التقييم والملاحظات
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="rating"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>التقييم (1-5)</FormLabel>
                                                <FormControl>
                                                    <div className="flex items-center gap-2">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <button
                                                                key={star}
                                                                type="button"
                                                                onClick={() => field.onChange(star)}
                                                                className="focus:outline-none transition-transform hover:scale-110"
                                                            >
                                                                <Star
                                                                    className={`w-8 h-8 ${field.value >= star
                                                                        ? "fill-amber-400 text-amber-400"
                                                                        : "text-slate-200"
                                                                        }`}
                                                                />
                                                            </button>
                                                        ))}
                                                    </div>
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
                                                        placeholder="أي ملاحظات حول جودة التوريد أو الالتزام بالمواعيد..."
                                                        className="min-h-24 leading-relaxed"
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
                    {isEditMode && existingSupplier && (
                        <>
                            {/* Status Card */}
                            <Card className="border-r-4 border-r-primary">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm">حالة المورد</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">رقم المورد:</span>
                                        <span className="font-mono font-bold">{existingSupplier.supplierNumber}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">الحالة:</span>
                                        <Badge variant={existingSupplier.isActive ? "default" : "secondary"}>
                                            {existingSupplier.isActive ? "نشط" : "غير نشط"}
                                        </Badge>
                                    </div>
                                    <Separator />
                                    <div className="space-y-3 pt-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500">المستحقات الحالية:</span>
                                            <span className={`font-bold ${existingSupplier.currentBalance > 0 ? "text-amber-600" : "text-green-600"}`}>
                                                {formatAmount(existingSupplier.currentBalance)}
                                                {existingSupplier.currentBalance === 0 && " ✓"}
                                            </span>
                                        </div>
                                        {existingSupplier.creditLimit && existingSupplier.creditLimit > 0 && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">الحد الائتماني:</span>
                                                <span className="font-mono text-slate-700">
                                                    {formatAmount(existingSupplier.creditLimit)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* History Card */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <History className="w-4 h-4 text-slate-400" />
                                        تاريخ السجل
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 text-xs">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                        <div>
                                            <p className="text-slate-500">تم الإنشاء في:</p>
                                            <p className="font-medium mt-0.5">
                                                {new Date(existingSupplier.createdAt).toLocaleString("ar-EG")}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                        <div>
                                            <p className="text-slate-500">آخر تعديل:</p>
                                            <p className="font-medium mt-0.5">
                                                {new Date(existingSupplier.updatedAt).toLocaleString("ar-EG")}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {!isEditMode && (
                        <Card className="bg-slate-50 border-dashed">
                            <CardContent className="pt-6">
                                <div className="text-center space-y-3">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-200 mx-auto shadow-sm">
                                        <Info className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-bold">إضافة مورد جديد</h3>
                                        <p className="text-xs text-slate-500 leading-relaxed px-4">
                                            عند إضافة مورد جديد، سيقوم النظام تلقائياً بتوليد رقم مورد فريد (مثال: SUP-0042) وتعيين الرصيد الابتدائي بـ 0.000
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Form Tips */}
                    <Card className="bg-emerald-50/50 border-emerald-100">
                        <CardContent className="pt-6 space-y-3">
                            <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                تلميحات
                            </h3>
                            <ul className="text-xs text-emerald-800 space-y-2 list-disc pr-4 opacity-80 leading-relaxed">
                                <li>يساعد الاسم اللاتيني في عمليات التصدير والتقارير المالية.</li>
                                <li>تحديد شرط الدفع (نقداً/آجل) يسهل عملية إنشاء فواتير المشتريات لاحقاً.</li>
                                <li>رقم الحساب البنكي ضروري في حالة التحويلات البنكية للموردين.</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
