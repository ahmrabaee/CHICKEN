
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    ChevronRight,
    Save,
    X,
    Package,
    Tag,
    DollarSign,
    Settings,
    Scale,
    AlertCircle,
    Loader2,
    Trash2,
    Info,
    PlusCircle,
    AlertTriangle
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
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import AdjustStockDialog from "@/components/inventory/AdjustStockDialog";

import { useCategories, useCreateItem, useItem } from "@/hooks/use-inventory";
import { CreateItemDto } from "@/types/inventory";
import { itemService } from "@/services/item.service";
import { toast } from "sonner";

const itemSchema = z.object({
    code: z.string().optional(),
    barcode: z.string().optional(),
    name: z.string().min(2, "اسم الصنف مطلوب"),
    description: z.string().optional(),
    categoryId: z.coerce.number().min(1, "يجب اختيار التصنيف"),
    defaultSalePrice: z.coerce.number().min(0, "سعر البيع مطلوب"),
    defaultPurchasePrice: z.coerce.number().min(0).optional(),
    taxRatePct: z.coerce.number().min(0).max(100).optional(),
    minStockLevel: z.coerce.number().min(0).optional(),
    maxStockLevel: z.coerce.number().min(0).optional(),
    shelfLifeDays: z.coerce.number().min(0).optional(),
    storageLocation: z.string().optional(),
    requiresScale: z.boolean().default(true),
    allowNegativeStock: z.boolean().default(false),
    isActive: z.boolean().default(true),
    initialQuantity: z.coerce.number().min(0).default(0),
    initialCostPrice: z.coerce.number().min(0).default(0),
});

type ItemFormValues = z.infer<typeof itemSchema>;

export default function ItemProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id;

    const { data: categories } = useCategories();
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [createError, setCreateError] = useState<{ messageAr?: string; message?: string } | null>(null);
    const { data: existingItem, isLoading: isLoadingItem } = useItem(parseInt(id || "0"));
    const createItemMutation = useCreateItem();

    const form = useForm<ItemFormValues>({
        resolver: zodResolver(itemSchema),
        defaultValues: {
            code: "",
            barcode: "",
            name: "",
            description: "",
            categoryId: 0,
            defaultSalePrice: 0,
            defaultPurchasePrice: 0,
            taxRatePct: 0,
            minStockLevel: 0,
            maxStockLevel: 0,
            shelfLifeDays: 0,
            storageLocation: "",
            requiresScale: true,
            allowNegativeStock: false,
            isActive: true,
            initialQuantity: 0,
            initialCostPrice: 0,
        },
    });

    useEffect(() => {
        if (existingItem) {
            form.reset({
                code: existingItem.code || "",
                barcode: existingItem.barcode || "",
                name: existingItem.name,
                description: existingItem.description || "",
                categoryId: existingItem.categoryId,
                defaultSalePrice: existingItem.defaultSalePrice / 100,
                defaultPurchasePrice: (existingItem.defaultPurchasePrice || 0) / 100,
                taxRatePct: (existingItem.taxRatePct || 0) / 100, // Assuming basis points
                minStockLevel: (existingItem.minStockLevel || 0) / 1000, // Grams to KG
                maxStockLevel: (existingItem.maxStockLevel || 0) / 1000, // Grams to KG
                shelfLifeDays: existingItem.shelfLifeDays || 0,
                storageLocation: existingItem.storageLocation || "",
                requiresScale: existingItem.requiresScale,
                allowNegativeStock: existingItem.allowNegativeStock,
                isActive: existingItem.isActive,
            });
        }
    }, [existingItem, form]);

    const purchasePrice = form.watch("defaultPurchasePrice");
    useEffect(() => {
        if (!isEditing) {
            const currentCost = form.getValues("initialCostPrice");
            // Only sync if initial cost is still at default (0)
            if (currentCost === 0 && purchasePrice && purchasePrice > 0) {
                form.setValue("initialCostPrice", purchasePrice);
            }
        }
    }, [purchasePrice, isEditing, form]);

    const onSubmit = async (values: ItemFormValues) => {
        setCreateError(null);
        try {
            const payload: CreateItemDto = {
                barcode: values.barcode,
                name: values.name,
                description: values.description,
                categoryId: values.categoryId,
                defaultSalePrice: Math.round(values.defaultSalePrice * 100),
                defaultPurchasePrice: values.defaultPurchasePrice ? Math.round(values.defaultPurchasePrice * 100) : undefined,
                taxRatePct: values.taxRatePct ? Math.round(values.taxRatePct * 100) : undefined,
                minStockLevelGrams: values.minStockLevel ? Math.round(values.minStockLevel * 1000) : undefined,
                maxStockLevelGrams: values.maxStockLevel ? Math.round(values.maxStockLevel * 1000) : undefined,
                shelfLifeDays: values.shelfLifeDays,
                storageLocation: values.storageLocation,
                requiresScale: values.requiresScale,
                allowNegativeStock: values.allowNegativeStock,
                isActive: values.isActive,
                initialQuantityGrams: values.initialQuantity ? Math.round(values.initialQuantity * 1000) : undefined,
                initialCostPrice: values.initialCostPrice ? Math.round(values.initialCostPrice * 100) : undefined,
            };

            if (isEditing) {
                await itemService.updateItem(parseInt(id!), payload);
                toast.success("تم تحديث البيانات بنجاح");
            } else {
                await createItemMutation.mutateAsync(payload);
            }
            navigate("/inventory");
        } catch (error: any) {
            console.error("Failed to save item:", error);
            const errData = error.response?.data;
            const errObj = errData?.error || errData;
            const messageAr = errObj?.messageAr || (Array.isArray(errObj?.message) ? errObj.message[0] : errObj?.message) || "فشل حفظ البيانات";
            console.error("Save item error:", error.response?.status, errData);
            setCreateError({
                messageAr,
                message: Array.isArray(errObj?.message) ? errObj.message.join(", ") : errObj?.message,
            });
            toast.error(messageAr);
        }
    };

    if (isEditing && isLoadingItem) {
        return (
            <div className="flex h-[80dvh] items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col gap-6 font-tajawal rtl pb-20" dir="rtl"
            >
                {/* Premium Header Bar */}
                <div className="sticky top-0 z-20 flex items-center justify-between bg-white/80 backdrop-blur-md p-4 border-b shadow-sm -mx-6 px-10">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory")}>
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold text-slate-800">
                                {isEditing ? `تعديل صنف: ${existingItem?.name}` : "إضافة صنف جديد"}
                            </h1>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] font-mono">
                                    {isEditing ? (existingItem?.code) : "جديد"}
                                </Badge>
                                {!valuesAreActive(form.getValues()) && (
                                    <Badge variant="destructive" className="text-[10px]">
                                        غير نشط
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="ghost" color="destructive" onClick={() => navigate("/inventory")}>
                            <X className="w-4 h-4 ml-2" />
                            إلغاء
                        </Button>
                        <Button onClick={form.handleSubmit(onSubmit)} className="gap-2 shadow-lg shadow-primary/20">
                            <Save className="w-4 h-4" />
                            حفظ البيانات
                        </Button>
                    </div>
                </div>

                <Form {...form}>
                    <form id="item-form" className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto w-full">
                        {/* Left Column: Form Sections */}
                        <div className="lg:col-span-2 space-y-8">

                            {/* Basic Information Section */}
                            <Card className="border-none shadow-premium overflow-hidden transition-all hover:shadow-md">
                                <div className="bg-slate-50 border-b p-4 flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                        <Package className="w-5 h-5" />
                                    </div>
                                    <h2 className="font-bold text-slate-700">البيانات الأساسية للمنتج</h2>
                                </div>
                                <CardContent className="p-6 space-y-5">
                                    {/* Row 1: name + barcode */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>اسم الصنف *</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="مثال: دجاج طازج كامل" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="barcode"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>الباركود</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="6251234..." {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {/* Row 2: category full width */}
                                    <FormField
                                        control={form.control}
                                        name="categoryId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>التصنيف *</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                                    <FormControl>
                                                        <SelectTrigger dir="rtl">
                                                            <SelectValue placeholder="اختر تصنيف المنتج" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent dir="rtl">
                                                        {categories?.map((cat) => (
                                                            <SelectItem key={cat.id} value={cat.id.toString()}>
                                                                {cat.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Row 3: description full width */}
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>الوصف</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="تفاصيل إضافية عن الصنف..."
                                                        className="min-h-[90px]"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            {/* Financial Section */}
                            <Card className="border-none shadow-premium overflow-hidden">
                                <div className="bg-slate-50 border-b p-4 flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                        <DollarSign className="w-5 h-5" />
                                    </div>
                                    <h2 className="font-bold text-slate-700">التسعير والضرائب</h2>
                                </div>
                                <CardContent className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="defaultSalePrice"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>سعر البيع الافتراضي (NIS/KG) *</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₪</span>
                                                            <NumericInput  step="0.01" className="pl-8 font-mono text-center" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="defaultPurchasePrice"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>سعر الشراء المتوقع (NIS/KG)</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₪</span>
                                                            <NumericInput  step="0.01" className="pl-8 font-mono text-center" {...field} />
                                                        </div>
                                                    </FormControl>
                                                    <FormDescription>للمرجع والمشتريات. إن لم يكن هناك رصيد، يُستخدم كقيمة معروضة لسعر التكلفة.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {isEditing && existingItem?.effectiveCostPrice != null && (
                                        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                                            <p className="text-sm font-medium text-slate-500 mb-1">سعر التكلفة الحالي (من النظام)</p>
                                            <p className="text-xl font-mono font-bold text-slate-800">₪{(existingItem.effectiveCostPrice / 100).toFixed(2)}</p>
                                            <FormDescription>محسوب من المخزون أو سعر الشراء المتوقع. للعرض فقط ولا يُحرّر من هنا.</FormDescription>
                                        </div>
                                    )}

                                    <FormField
                                        control={form.control}
                                        name="taxRatePct"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>نسبة الضريبة (%)</FormLabel>
                                                <FormControl>
                                                    <div className="relative max-w-[200px]">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                                                        <NumericInput  step="0.1" className="pl-8 font-mono text-center" {...field} />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            {/* Inventory Initialization (Only for New Items) */}
                            {!isEditing && (
                                <>
                                    <Card className="border-none shadow-premium overflow-hidden border-2 border-primary/20 bg-primary/5">
                                        <div className="bg-primary/10 border-b p-4 flex items-center gap-3">
                                            <div className="p-2 bg-primary text-primary-foreground rounded-lg shadow-sm">
                                                <Package className="w-5 h-5" />
                                            </div>
                                            <h2 className="font-bold text-primary">المخزون الافتتاحي (Opening Stock)</h2>
                                        </div>
                                        <CardContent className="p-6 space-y-6">
                                            {/* بطاقة توضيح الخطأ عند فشل الحفظ */}
                                            {createError && (
                                                <Card className="border-2 border-destructive/50 bg-destructive/5 overflow-hidden">
                                                    <CardContent className="p-5 space-y-4">
                                                        <div className="flex items-start gap-3">
                                                            <div className="p-2 rounded-lg bg-destructive/10">
                                                                <AlertTriangle className="w-5 h-5 text-destructive" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <h3 className="font-bold text-destructive mb-1">حدث خطأ في حفظ الصنف</h3>
                                                                <p className="text-sm text-muted-foreground mb-3">
                                                                    {createError.messageAr || createError.message}
                                                                </p>
                                                                <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                                                                    <p className="font-semibold text-foreground">ما الذي يمكنك فعله؟</p>
                                                                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                                                        <li><strong>الكمية المتوفرة = صفر:</strong> هذا مقبول. يُنشأ الصنف بدون رصيد ويمكنك إضافته لاحقاً عبر "تسوية المخزون".</li>
                                                                        <li><strong>إذا أدخلت كمية أكبر من صفر:</strong> يجب إدخال "سعر تكلفة الرصيد الافتتاحي" أيضاً.</li>
                                                                        <li><strong>مدة الصلاحية:</strong> إذا أدخلت صفر، اترك الحقل فارغاً أو أدخل 1 يوم أو أكثر.</li>
                                                                        <li><strong>مكان التخزين:</strong> اختر من: الثلاجة، المجمد، أو ثلاجة العرض فقط.</li>
                                                                        <li><strong>تأكد من:</strong> اختيار التصنيف، وإدخال سعر البيع بشكل صحيح.</li>
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField
                                                    control={form.control}
                                                    name="initialQuantity"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="flex items-center gap-2">
                                                                الكمية المتوفرة حالياً (KG)
                                                                <Badge variant="secondary" className="text-[10px]">اختياري</Badge>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <NumericInput  step="0.001" className="font-mono text-center text-lg bg-white" {...field} />
                                                            </FormControl>
                                                            <FormDescription>الوزن الافتتاحي المتوفر في المحل</FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="initialCostPrice"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="flex items-center gap-2">
                                                                سعر تكلفة الرصيد الافتتاحي (NIS/KG)
                                                                <Badge variant="secondary" className="text-[10px]">اختياري</Badge>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₪</span>
                                                                    <NumericInput  step="0.01" className="pl-8 font-mono text-center text-lg bg-white" {...field} />
                                                                </div>
                                                            </FormControl>
                                                            <FormDescription>يُستخدم مرة واحدة لتهيئة قيمة الرصيد الافتتاحي فقط (لا يُخزن على بطاقة الصنف)</FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            )}

                            {/* Inventory Management Section */}
                            <Card className="border-none shadow-premium overflow-hidden">
                                <div className="bg-slate-50 border-b p-4 flex items-center gap-3">
                                    <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                                        <AlertCircle className="w-5 h-5" />
                                    </div>
                                    <h2 className="font-bold text-slate-700">مستويات المخزون والتحذيرات</h2>
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="minStockLevel"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>حد الطلب (الحد الأدنى) - KG</FormLabel>
                                                    <FormControl>
                                                        <NumericInput  step="0.1" className="font-mono text-right" {...field} />
                                                    </FormControl>
                                                    <FormDescription>سيظهر تنبيه عند وصول المخزون لهذه الكمية</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="maxStockLevel"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>الحد الأقصى - KG</FormLabel>
                                                    <FormControl>
                                                        <NumericInput  step="0.1" className="font-mono text-right" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                        <FormField
                                            control={form.control}
                                            name="shelfLifeDays"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>مدة الصلاحية (بالأيام)</FormLabel>
                                                    <FormControl>
                                                        <NumericInput  {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="storageLocation"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>مكان التخزين</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger dir="rtl">
                                                                <SelectValue placeholder="اختر مكان التخزين" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent dir="rtl">
                                                            <SelectItem value="fridge">الثلاجة (Fridge)</SelectItem>
                                                            <SelectItem value="freezer">المجمد (Freezer)</SelectItem>
                                                            <SelectItem value="display">ثلاجة العرض</SelectItem>
                                                            <SelectItem value="shelf">رفوف جافة</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column: Sidebar Status & Settings */}
                        <div className="space-y-6">
                            {/* Current Inventory Status (Existing Items Only) */}
                            {isEditing && (
                                <Card className="border-none shadow-premium overflow-hidden bg-white">
                                    <div className="bg-slate-50 border-b p-4 font-bold flex items-center gap-2">
                                        <Package className="w-4 h-4 text-primary" />
                                        حالة المخزون الحالي
                                    </div>
                                    <CardContent className="p-6 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">إجمالي الكمية</p>
                                                <p className="text-lg font-mono font-black text-slate-800">
                                                    {(existingItem?.inventory?.currentQuantityGrams || 0) / 1000} <span className="text-[10px] font-normal text-slate-500">كجم</span>
                                                </p>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">الكمية المتاحة</p>
                                                <p className="text-lg font-mono font-black text-emerald-600">
                                                    {((existingItem?.inventory?.currentQuantityGrams || 0) - (existingItem?.inventory?.reservedQuantityGrams || 0)) / 1000} <span className="text-[10px] font-normal text-slate-500">كجم</span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-2">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">متوسط التكلفة (Avg):</span>
                                                <span className="font-mono font-bold text-slate-700">₪{((existingItem?.inventory?.averageCost || 0) / 100).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-500">إجمالي قيمة المخزون:</span>
                                                <span className="font-mono font-bold text-slate-900 text-lg">₪{((existingItem?.inventory?.totalValue || 0) / 100).toFixed(2)}</span>
                                            </div>
                                        </div>

                                        <Separator />
                                        <div className="pt-2">
                                            <Button
                                                variant="outline"
                                                type="button"
                                                className="w-full gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                                                onClick={() => setIsAdjusting(true)}
                                            >
                                                <PlusCircle className="w-4 h-4" />
                                                تعديل الرصيد / زيادة الكمية
                                            </Button>
                                        </div>

                                        <div className="flex flex-col gap-2 pt-2">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-slate-400">آخر توريد:</span>
                                                <span className="text-slate-600">{existingItem?.inventory?.lastRestockedAt ? new Date(existingItem.inventory.lastRestockedAt).toLocaleDateString("en-US") : "---"}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-slate-400">آخر بيع:</span>
                                                <span className="text-slate-600">{existingItem?.inventory?.lastSoldAt ? new Date(existingItem.inventory.lastSoldAt).toLocaleDateString("en-US") : "---"}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                            <Card className="border-none shadow-premium sticky top-24 overflow-hidden bg-slate-50/50">
                                <div className="p-4 border-b font-bold flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-slate-500" />
                                    إعدادات متقدمة
                                </div>
                                <CardContent className="p-6 space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="isActive"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-white shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">نشط</FormLabel>
                                                    <FormDescription>
                                                        إتاحة الصنف للبيع والشراء
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

                                    <FormField
                                        control={form.control}
                                        name="requiresScale"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-white shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base flex items-center gap-2">
                                                        <Scale className="w-4 h-4 text-slate-400" />
                                                        يتطلب ميزان
                                                    </FormLabel>
                                                    <FormDescription>
                                                        إلزامية الوزن عند البيع
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

                                    <FormField
                                        control={form.control}
                                        name="allowNegativeStock"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-white shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">مخزون سالب</FormLabel>
                                                    <FormDescription>
                                                        السماح بالبيع تحت الصفر
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

                                    <Separator />

                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold text-slate-500 flex items-center gap-2">
                                            <Info className="w-4 h-4" />
                                            ملاحظات النظام
                                        </h4>
                                        <div className="text-xs text-slate-500 bg-white p-3 rounded-lg border border-dashed border-slate-200 leading-normal">
                                            يرجى التأكد من إدخال **سعر البيع** بشكل صحيح، حيث يتم اعتماده كقيمة افتراضية في شاشة الكاشير (POS).
                                        </div>
                                    </div>

                                    {isEditing && (
                                        <div className="pt-4 border-t">
                                            <Button variant="outline" className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-100 gap-2">
                                                <Trash2 className="w-4 h-4" />
                                                حذف هذا الصنف نهائياً
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </form>
                </Form>
            </motion.div>

            {/* Mapping Item to InventoryItem for the Dialog */}
            {isEditing && existingItem && (
                <AdjustStockDialog
                    item={isAdjusting ? {
                        id: existingItem.inventory?.currentQuantityGrams || 0,
                        itemId: existingItem.id,
                        itemCode: existingItem.code,
                        itemName: existingItem.name,
                        categoryName: existingItem.categoryName || "",
                        branchId: 0,
                        branchName: "الفرع الرئيسي",
                        totalQuantity: existingItem.inventory?.currentQuantityGrams || 0,
                        availableQuantity: (existingItem.inventory?.currentQuantityGrams || 0) - (existingItem.inventory?.reservedQuantityGrams || 0),
                        unitOfMeasure: existingItem.unitOfMeasure,
                        minStockLevel: existingItem.minStockLevel || 0,
                        isLowStock: (existingItem.inventory?.currentQuantityGrams || 0) < (existingItem.minStockLevel || 0),
                        sellingPrice: existingItem.defaultSalePrice,
                        avgCostPrice: existingItem.inventory?.averageCost,
                        batches: []
                    } as any : null}
                    onClose={() => setIsAdjusting(false)}
                />
            )}
        </>
    );
}

function valuesAreActive(values: any) {
    return values.isActive;
}
