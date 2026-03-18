import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Save, Trash2, X, Loader2, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
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
import { Switch } from "@/components/ui/switch";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSuppliers } from "@/hooks/use-suppliers";
import { usePurchaseableCategories } from "@/hooks/use-inventory";
import { useCreatePurchase, usePurchase, useUpdatePurchase } from "@/hooks/use-purchases";
import { bankAccountsService } from "@/services/bank-accounts.service";
import type { CreatePurchaseDto } from "@/types/purchases";

// UI uses major units (₪) and kg. API expects minor units and grams.
const purchaseSchema = z.object({
  supplierId: z.coerce.number().min(1, "يجب اختيار التاجر"),
  purchaseDate: z.string().optional(),
  dueDate: z.string().optional(),
  taxAmount: z.coerce.number().min(0, "قيمة الضريبة غير صحيحة").optional(),
  amountPaid: z.coerce.number().min(0, "المبلغ المدفوع غير صحيح").optional(),
  paymentMethod: z.string().optional(),
  bankAccountId: z.coerce.number().optional(),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        itemId: z.coerce.number().min(1, "اختر الفئة"),
        weightKg: z.coerce.number().positive("الوزن مطلوب"),
        pricePerKg: z.coerce.number().min(0, "السعر غير صحيح"),
        isLiveBird: z.boolean().optional().default(false),
      })
    )
    .min(1, "أضف فئةً واحدة على الأقل"),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

function toMinorUnits(amountMajor: number): number {
  return Math.round((amountMajor || 0) * 100);
}

function kgToGrams(kg: number): number {
  return Math.round((kg || 0) * 1000);
}

export default function PurchaseProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const purchaseId = isEditing ? Number(id) : 0;
  const createPurchase = useCreatePurchase();
  const updatePurchase = useUpdatePurchase();

  const [supplierSearch, setSupplierSearch] = useState("");

  const { data: existingPurchase, isLoading: isFetchingPurchase } = usePurchase(purchaseId);

  const { data: suppliersResp, isLoading: suppliersLoading } = useSuppliers({
    page: 1,
    pageSize: 100,
    search: supplierSearch || undefined,
  });
  const suppliers = suppliersResp?.data || [];

  const { data: purchaseableCategories = [], isLoading: categoriesLoading } = usePurchaseableCategories();

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      supplierId: 0,
      purchaseDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      taxAmount: 0,
      amountPaid: 0,
      paymentMethod: "cash",
      bankAccountId: undefined,
      notes: "",
      lines: [{ itemId: 0, weightKg: 1, pricePerKg: 0, isLiveBird: false }], // itemId = category.id (resolved to purchaseItemId on submit)
    },
    mode: "onChange",
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchedLines = useWatch({ control: form.control, name: "lines", defaultValue: form.getValues("lines") });
  const watchedTax = useWatch({ control: form.control, name: "taxAmount", defaultValue: 0 });

  const subtotalMajor = useMemo(() => {
    const lines = Array.isArray(watchedLines) ? watchedLines : [];
    return lines.reduce((sum, l) => {
      const w = Number(l?.weightKg) || 0;
      const p = Number(l?.pricePerKg) || 0;
      return sum + w * p;
    }, 0);
  }, [watchedLines]);

  const taxNum = Number(watchedTax) || 0;
  const watchedPaid = useWatch({ control: form.control, name: "amountPaid", defaultValue: 0 });
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod", defaultValue: "cash" });
  const amountPaidNum = Number(watchedPaid) || 0;
  const grandTotalMajor = subtotalMajor + taxNum;
  const remainingMajor = Math.max(0, grandTotalMajor - amountPaidNum);
  const hasSelectedItem = (watchedLines || []).some((l: { itemId?: number }) => (l?.itemId || 0) > 0);

  const { data: bankAccountsRes } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const res = await bankAccountsService.getAll(false);
      return res.data?.data ?? res.data ?? [];
    },
  });
  const bankAccounts = (Array.isArray(bankAccountsRes) ? bankAccountsRes : []) as { id: number; code: string; name: string }[];

  useEffect(() => {
    if (!isEditing || !existingPurchase || categoriesLoading) return;

    const mappedLines = (existingPurchase.purchaseLines || []).length > 0
      ? (existingPurchase.purchaseLines || []).map((line) => {
        const category = purchaseableCategories.find((c) => c.purchaseItemId === line.itemId);
        return {
          itemId: category?.id ?? line.itemId,
          weightKg: Number((line.weightGrams / 1000).toFixed(3)),
          pricePerKg: Number((line.pricePerKg / 100).toFixed(2)),
          isLiveBird: !!line.isLiveBird,
        };
      })
      : [{ itemId: 0, weightKg: 1, pricePerKg: 0, isLiveBird: false }];

    form.reset({
      supplierId: existingPurchase.supplierId || 0,
      purchaseDate: existingPurchase.purchaseDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      dueDate: existingPurchase.dueDate ? existingPurchase.dueDate.slice(0, 10) : "",
      taxAmount: (existingPurchase.taxAmount || 0) / 100,
      amountPaid: 0,
      notes: existingPurchase.notes || "",
      lines: mappedLines,
    });
  }, [isEditing, existingPurchase, categoriesLoading, purchaseableCategories, form]);

  const onSubmit = async (values: PurchaseFormValues) => {
    const supplierId = Number(values.supplierId);
    if (!supplierId || supplierId < 1) {
      form.setError("supplierId", { message: "يجب اختيار التاجر" });
      return;
    }
    const lines = values.lines
      .filter((l) => Number(l.itemId) > 0 && (Number(l.weightKg) || 0) > 0)
      .map((l) => {
        // l.itemId holds category.id — resolve to the actual purchaseItemId
        const cat = purchaseableCategories.find((c) => c.id === Number(l.itemId));
        return {
          itemId: cat?.purchaseItemId ?? Number(l.itemId),
          weightGrams: kgToGrams(Number(l.weightKg)),
          pricePerKg: toMinorUnits(Number(l.pricePerKg)),
          isLiveBird: !!l.isLiveBird,
        };
      });
    if (lines.length === 0) {
      toast.error("أضف فئةً واحدة على الأقل بوزن صحيح");
      return;
    }
    const dto: CreatePurchaseDto = {
      supplierId,
      purchaseDate: values.purchaseDate?.trim() ? values.purchaseDate : undefined,
      dueDate: values.dueDate?.trim() ? values.dueDate : undefined,
      taxAmount: values.taxAmount != null && values.taxAmount > 0 ? toMinorUnits(values.taxAmount) : undefined,
      amountPaid: values.amountPaid != null && values.amountPaid > 0 ? toMinorUnits(values.amountPaid) : undefined,
      paymentMethod: values.amountPaid != null && values.amountPaid > 0 ? (values.paymentMethod || "cash") : undefined,
      bankAccountId: values.amountPaid != null && values.amountPaid > 0 && (values.paymentMethod === "bank_transfer" || values.paymentMethod === "card") ? values.bankAccountId : undefined,
      notes: values.notes?.trim() ? values.notes.trim() : undefined,
      lines,
    };

    if (isEditing) {
      await updatePurchase.mutateAsync({ id: purchaseId, data: dto });
    } else {
      const created = await createPurchase.mutateAsync(dto);
      void created;
    }

    navigate(`/purchasing`, { replace: true });
    // toast is handled in hooks
  };

  const isSaving = createPurchase.isPending || updatePurchase.isPending;

  if (isEditing && isFetchingPurchase) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{isEditing ? "تعديل أمر الشراء" : "أمر شراء جديد"}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/purchasing">
            <Button type="button" variant="outline" className="gap-2">
              <X className="w-4 h-4" />
              إلغاء
            </Button>
          </Link>
        </div>
      </div>

      <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              const first = Object.values(errors)[0];
              const msg = first?.message ?? "يرجى تصحيح الأخطاء في النموذج";
              toast.error(String(msg));
            })}
            className="space-y-6"
          >
          {/* Main info */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>التاجر</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            placeholder="بحث عن تاجر..."
                            value={supplierSearch}
                            onChange={(e) => setSupplierSearch(e.target.value)}
                          />
                          <Select
                            value={field.value && field.value > 0 ? String(field.value) : ""}
                            onValueChange={(v) => field.onChange(v ? Number(v) : 0)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={suppliersLoading ? "جاري تحميل التجار..." : "اختر التاجر"} />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map((s) => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchaseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ الشراء</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="اختر تاريخ الشراء"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ الاستحقاق (اختياري)</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="اختر تاريخ الاستحقاق"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="md:col-span-1">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ملاحظات (اختياري)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="أي تفاصيل إضافية..." rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Lines */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <h2 className="font-semibold">الفئات</h2>
                  <span className="text-xs text-muted-foreground">({fields.length})</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => append({ itemId: 0, weightKg: 1, pricePerKg: 0, isLiveBird: false })}
                  >
                    <Plus className="w-4 h-4" />
                    إضافة فئة
                  </Button>
                </div>
              </div>

              {/* Table header */}
              <div className="hidden md:grid grid-cols-[3fr_2fr_2fr_2fr_auto_auto] gap-3 px-3 pb-1 border-b">
                <span className="text-xs font-semibold text-muted-foreground">الفئة</span>
                <span className="text-xs font-semibold text-muted-foreground">الوزن (كجم)</span>
                <span className="text-xs font-semibold text-muted-foreground">السعر/كجم (₪)</span>
                <span className="text-xs font-semibold text-muted-foreground">الإجمالي</span>
                <span className="text-xs font-semibold text-muted-foreground text-center w-16">حي؟</span>
                <span className="w-9" />
              </div>

              <div className="space-y-2">
                {fields.map((f, idx) => {
                  const lineTotal = (Number(watchedLines?.[idx]?.weightKg) || 0) * (Number(watchedLines?.[idx]?.pricePerKg) || 0);
                  return (
                    <div key={f.id} className="grid grid-cols-1 md:grid-cols-[3fr_2fr_2fr_2fr_auto_auto] gap-3 items-start p-2 rounded-lg hover:bg-muted/30 transition-colors">

                      {/* الفئة */}
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.itemId`}
                        render={({ field }) => (
                          <FormItem className="space-y-0">
                            <span className="md:hidden text-xs font-semibold text-muted-foreground">الفئة</span>
                            <FormControl>
                              <Select
                                value={String(field.value || "")}
                                onValueChange={(v) => {
                                  const categoryId = Number(v);
                                  field.onChange(categoryId);
                                  const cat = purchaseableCategories.find((c) => c.id === categoryId);
                                  if (!cat?.purchaseItem) return;
                                  // Use defaultPurchasePrice first, fallback to averageCost from inventory (both in minor units)
                                  const def = cat.purchaseItem.defaultPurchasePrice ?? 0;
                                  const avg = cat.purchaseItem.averageCost ?? 0;
                                  const priceMinor = def > 0 ? def : avg;
                                  const priceMajor = priceMinor / 100;
                                  if (priceMajor > 0) {
                                    form.setValue(`lines.${idx}.pricePerKg`, priceMajor, { shouldDirty: true, shouldValidate: true });
                                  }
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder={categoriesLoading ? "تحميل..." : "اختر الفئة"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {purchaseableCategories
                                    .filter((cat) => (cat.purchaseItemId ?? 0) > 0)
                                    .map((cat) => (
                                      <SelectItem key={cat.id} value={String(cat.id)}>
                                        {cat.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />

                      {/* الوزن */}
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.weightKg`}
                        render={({ field }) => (
                          <FormItem className="space-y-0">
                            <span className="md:hidden text-xs font-semibold text-muted-foreground">الوزن (كجم)</span>
                            <FormControl>
                              <NumericInput className="h-9" inputMode="decimal" step="0.01" min="0" {...field} />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />

                      {/* السعر */}
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.pricePerKg`}
                        render={({ field }) => (
                          <FormItem className="space-y-0">
                            <span className="md:hidden text-xs font-semibold text-muted-foreground">السعر/كجم (₪)</span>
                            <FormControl>
                              <NumericInput className="h-9" inputMode="decimal" step="0.01" min="0" {...field} />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />

                      {/* الإجمالي */}
                      <div className="flex items-center h-9">
                        <span className="font-semibold text-sm font-english text-foreground" dir="ltr">
                          ₪ {lineTotal.toFixed(2)}
                        </span>
                      </div>

                      {/* حي؟ */}
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.isLiveBird`}
                        render={({ field }) => (
                          <FormItem className="space-y-0">
                            <FormControl>
                              <div className="flex items-center gap-1.5 h-9 w-16 justify-center">
                                <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {/* حذف */}
                      <div className="flex items-center h-9">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => remove(idx)}
                          title="حذف السطر"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />

              {/* Totals */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  تذكير: الباك هو المرجع النهائي للحسابات، وهذا عرض تقريبي فقط.
                </p>
                <div className="bg-muted/40 rounded-lg px-6 py-4 grid grid-cols-2 gap-x-8 gap-y-4 text-sm items-center min-w-[350px]">
                  <span className="text-muted-foreground">المجموع</span>
                  <span className="text-left font-english" dir="ltr">₪ {subtotalMajor.toFixed(2)}</span>

                  <span className="text-muted-foreground">الضريبة (₪)</span>
                  <FormField
                    control={form.control}
                    name="taxAmount"
                    render={({ field }) => (
                      <FormControl>
                        <NumericInput

                          step="0.01"
                          className="h-8 text-left font-english w-28 mr-auto py-0"
                          {...field}
                        />
                      </FormControl>
                    )}
                  />

                  <div className="col-span-2 border-t border-muted-foreground/10 my-1" />

                  <span className="text-muted-foreground font-bold">الإجمالي النهائي</span>
                  <span className="text-left font-bold font-english text-lg" dir="ltr">₪ {grandTotalMajor.toFixed(2)}</span>

                  {!isEditing ? (
                    <>
                  <span className="text-green-700 font-bold flex flex-col gap-1">
                    <span>المبلغ المدفوع (₪)</span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-[10px] text-primary w-fit underline"
                      onClick={() => form.setValue("amountPaid", grandTotalMajor)}
                    >
                      دفع الكل
                    </Button>
                  </span>
                  <FormField
                    control={form.control}
                    name="amountPaid"
                    render={({ field }) => (
                      <FormControl>
                        <NumericInput

                          step="0.01"
                          className="h-9 text-left font-english font-bold text-green-700 w-32 mr-auto py-0"
                          {...field}
                        />
                      </FormControl>
                    )}
                  />

                  {(grandTotalMajor > 0 || hasSelectedItem) && (
                    <>
                      <FormField
                        control={form.control}
                        name="paymentMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-muted-foreground text-sm">طريقة الدفع</FormLabel>
                            <Select value={field.value ?? "cash"} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="h-9">
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
                      {(paymentMethod === "bank_transfer" || paymentMethod === "card") && bankAccounts.length > 0 ? (
                        <FormField
                          control={form.control}
                          name="bankAccountId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-muted-foreground text-sm">الحساب البنكي</FormLabel>
                              <Select
                                value={field.value ? String(field.value) : ""}
                                onValueChange={(v) => field.onChange(v ? parseInt(v, 10) : undefined)}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="اختر البنك" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent dir="rtl">
                                  {bankAccounts.map((b) => (
                                    <SelectItem key={b.id} value={String(b.id)}>
                                      {b.code} - {b.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : (paymentMethod === "bank_transfer" || paymentMethod === "card") && bankAccounts.length === 0 ? (
                        <div className="col-span-2 text-amber-600 text-xs flex items-center gap-2">
                          <Link to="/settings" className="underline">أضف حسابات بنكية من الإعدادات</Link> لتفعيل التحويل البنكي
                        </div>
                      ) : null}
                    </>
                  )}
                    </>
                  ) : (
                    <div className="col-span-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                      💡 لتعديل الدفعات، استخدم صفحة <Link to="/payments" className="underline font-bold">المدفوعات</Link>
                    </div>
                  )}

                  <div className="col-span-2 border-t border-muted-foreground/10 my-2" />

                  <span className="text-muted-foreground font-semibold">المتبقي (دين)</span>
                  <span className="text-left text-red-600 font-english font-bold text-xl" dir="ltr">₪ {remainingMajor.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer actions - Save & Cancel at bottom for easier access */}
          <div className="flex flex-col sm:flex-row gap-3 sticky bottom-4 bg-background/95 backdrop-blur py-4 rounded-lg border shadow-lg px-4">
            <Link to="/purchasing" className="order-2 sm:order-1">
              <Button type="button" variant="outline" className="w-full sm:w-auto gap-2">
                <X className="w-4 h-4" />
                إلغاء
              </Button>
            </Link>
            <Button
              type="submit"
              className="flex-1 gap-2 order-1 sm:order-2"
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEditing ? "حفظ التعديلات" : "حفظ أمر الشراء"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

