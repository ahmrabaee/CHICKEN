import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Save, Trash2, X, Loader2, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

import { toast } from "sonner";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useItems } from "@/hooks/use-inventory";
import { useCreatePurchase } from "@/hooks/use-purchases";
import type { Item } from "@/types/inventory";
import type { CreatePurchaseDto } from "@/types/purchases";

// UI uses major units (₪) and kg. API expects minor units and grams.
const purchaseSchema = z.object({
  supplierId: z.coerce.number().min(1, "يجب اختيار التاجر"),
  purchaseDate: z.string().optional(),
  dueDate: z.string().optional(),
  taxAmount: z.coerce.number().min(0, "قيمة الضريبة غير صحيحة").optional(),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        itemId: z.coerce.number().min(1, "اختر الصنف"),
        weightKg: z.coerce.number().positive("الوزن مطلوب"),
        pricePerKg: z.coerce.number().min(0, "السعر غير صحيح"),
        isLiveBird: z.boolean().optional().default(false),
      })
    )
    .min(1, "أضف صنفًا واحدًا على الأقل"),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

function toMinorUnits(amountMajor: number): number {
  return Math.round((amountMajor || 0) * 100);
}

function kgToGrams(kg: number): number {
  return Math.round((kg || 0) * 1000);
}

export default function PurchaseProfile() {
  const navigate = useNavigate();
  const createPurchase = useCreatePurchase();

  // Lightweight server-side search for suppliers/items (keeps UI fast for large lists)
  const [supplierSearch, setSupplierSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");

  const { data: suppliersResp, isLoading: suppliersLoading } = useSuppliers({
    page: 1,
    pageSize: 100,
    search: supplierSearch || undefined,
  });
  const suppliers = suppliersResp?.data || [];

  const { data: itemsResp, isLoading: itemsLoading } = useItems({
    isActive: true,
    page: 1,
    pageSize: 100,
    search: itemSearch || undefined,
  });
  const items = itemsResp?.data || [];

  const itemsById = useMemo(() => {
    const map = new Map<number, Item>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      supplierId: 0,
      purchaseDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      taxAmount: 0,
      notes: "",
      lines: [{ itemId: 0, weightKg: 1, pricePerKg: 0, isLiveBird: false }],
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
  const grandTotalMajor = subtotalMajor + taxNum;

  const onSubmit = async (values: PurchaseFormValues) => {
    const supplierId = Number(values.supplierId);
    if (!supplierId || supplierId < 1) {
      form.setError("supplierId", { message: "يجب اختيار التاجر" });
      return;
    }
    const lines = values.lines
      .filter((l) => Number(l.itemId) > 0 && (Number(l.weightKg) || 0) > 0)
      .map((l) => ({
        itemId: Number(l.itemId),
        weightGrams: kgToGrams(Number(l.weightKg)),
        pricePerKg: toMinorUnits(Number(l.pricePerKg)),
        isLiveBird: !!l.isLiveBird,
      }));
    if (lines.length === 0) {
      toast.error("أضف صنفًا واحدًا على الأقل بوزن صحيح");
      return;
    }
    const dto: CreatePurchaseDto = {
      supplierId,
      purchaseDate: values.purchaseDate?.trim() ? values.purchaseDate : undefined,
      dueDate: values.dueDate?.trim() ? values.dueDate : undefined,
      taxAmount: values.taxAmount != null && values.taxAmount > 0 ? toMinorUnits(values.taxAmount) : undefined,
      notes: values.notes?.trim() ? values.notes.trim() : undefined,
      lines,
    };

    const created = await createPurchase.mutateAsync(dto);
    navigate(`/purchasing`, { replace: true });
    // toast is handled in hook
    void created;
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">أمر شراء جديد</h1>
          <p className="text-muted-foreground mt-1">إنشاء أمر شراء بالتفاصيل كاملة (RTL + عربي) مثل نمط المخزون</p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/purchasing">
            <Button type="button" variant="outline" className="gap-2">
              <X className="w-4 h-4" />
              إلغاء
            </Button>
          </Link>
          <Button
            type="button"
            className="gap-2"
            onClick={form.handleSubmit(onSubmit)}
            disabled={createPurchase.isPending}
          >
            {createPurchase.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            حفظ أمر الشراء
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                          <Select value={String(field.value || "")} onValueChange={(v) => field.onChange(v)}>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="taxAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الضريبة (₪)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground mt-1">يُرسل للباك بوحدة السنت (minor units)</p>
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2">
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
              </div>
            </CardContent>
          </Card>

          {/* Lines */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <h2 className="font-semibold">الأصناف</h2>
                  <span className="text-xs text-muted-foreground">({fields.length})</span>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    placeholder="بحث عن صنف..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-56"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => append({ itemId: 0, weightKg: 1, pricePerKg: 0, isLiveBird: false })}
                  >
                    <Plus className="w-4 h-4" />
                    إضافة صنف
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                {fields.map((f, idx) => (
                  <div key={f.id} className="border rounded-lg p-4 bg-background">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <FormField
                        control={form.control}
                        name={`lines.${idx}.itemId`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-5">
                            <FormLabel>الصنف</FormLabel>
                            <FormControl>
                              <Select
                                value={String(field.value || "")}
                                onValueChange={(v) => {
                                  field.onChange(v);
                                  const item = itemsById.get(Number(v));
                                  if (!item) return;
                                  const currentPrice = Number(form.getValues(`lines.${idx}.pricePerKg`)) || 0;
                                  const defaultPriceMinor = item.defaultPurchasePrice ?? 0;
                                  const defaultPriceMajor = defaultPriceMinor / 100;
                                  if (currentPrice === 0 && defaultPriceMajor > 0) {
                                    form.setValue(`lines.${idx}.pricePerKg`, defaultPriceMajor, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={itemsLoading ? "تحميل الأصناف..." : "اختر الصنف"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {items.map((it) => (
                                    <SelectItem key={it.id} value={String(it.id)}>
                                      {it.name} — {it.code}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`lines.${idx}.weightKg`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>الوزن (كجم)</FormLabel>
                            <FormControl>
                              <Input type="number" inputMode="decimal" step="0.01" min="0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`lines.${idx}.pricePerKg`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>السعر/كجم (₪)</FormLabel>
                            <FormControl>
                              <Input type="number" inputMode="decimal" step="0.01" min="0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`lines.${idx}.isLiveBird`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>حي؟</FormLabel>
                            <FormControl>
                              <div className="h-10 flex items-center">
                                <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                                <span className="text-xs text-muted-foreground mr-2">طير حي</span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="md:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-red-600 hover:text-red-700"
                          onClick={() => remove(idx)}
                          title="حذف السطر"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Line total preview */}
                    <div className="mt-3 text-sm text-muted-foreground">
                      الإجمالي التقريبي للسطر:{" "}
                      <span className="font-semibold text-foreground font-english" dir="ltr">
                        ₪ {(((Number(watchedLines?.[idx]?.weightKg) || 0) * (Number(watchedLines?.[idx]?.pricePerKg) || 0)) || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Totals */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  تذكير: الباك هو المرجع النهائي للحسابات، وهذا عرض تقريبي فقط.
                </p>
                <div className="bg-muted/40 rounded-lg px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <span className="text-muted-foreground">المجموع</span>
                  <span className="text-left font-english" dir="ltr">₪ {subtotalMajor.toFixed(2)}</span>
                  <span className="text-muted-foreground">الضريبة</span>
                  <span className="text-left font-english" dir="ltr">₪ {taxNum.toFixed(2)}</span>
                  <span className="text-muted-foreground font-semibold">الإجمالي</span>
                  <span className="text-left font-semibold font-english" dir="ltr">₪ {grandTotalMajor.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mobile sticky actions (optional but helpful) */}
          <div className="md:hidden flex gap-2">
            <Link to="/purchasing" className="flex-1">
              <Button type="button" variant="outline" className="w-full gap-2">
                <X className="w-4 h-4" />
                إلغاء
              </Button>
            </Link>
            <Button
              type="submit"
              className="flex-1 gap-2"
              disabled={createPurchase.isPending}
            >
              {createPurchase.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              حفظ
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

