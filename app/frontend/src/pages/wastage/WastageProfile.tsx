import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Save, Loader2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
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

import { useItems, useInventoryLots } from "@/hooks/use-inventory";
import { useCreateWastage } from "@/hooks/use-wastage";
import type { CreateWastageDto, WastageReason } from "@/types/wastage";

const wastageSchema = z.object({
  itemId: z.coerce.number().min(1, "يجب اختيار الصنف"),
  lotId: z.coerce.number().min(1, "يجب اختيار الدفعة"),
  quantityKg: z.coerce.number().positive("الكمية يجب أن تكون موجبة"),
  reason: z.enum(["expired", "damaged", "spoiled", "processing_loss", "other"], {
    required_error: "يجب اختيار سبب الهدر",
  }),
  notes: z.string().optional(),
});

type WastageFormValues = z.infer<typeof wastageSchema>;

const REASON_OPTIONS: { value: WastageReason; label: string }[] = [
  { value: "expired", label: "منتهي الصلاحية" },
  { value: "damaged", label: "تالف" },
  { value: "spoiled", label: "فاسد" },
  { value: "processing_loss", label: "فقد تصنيع" },
  { value: "other", label: "أخرى" },
];

function kgToGrams(kg: number): number {
  return Math.round((kg || 0) * 1000);
}

export default function WastageProfile() {
  const navigate = useNavigate();
  const createWastage = useCreateWastage();

  const { data: itemsResp } = useItems({ isActive: true, page: 1, pageSize: 100 });
  const items = itemsResp?.data ?? [];

  const form = useForm<WastageFormValues>({
    resolver: zodResolver(wastageSchema),
    defaultValues: {
      itemId: 0,
      lotId: 0,
      quantityKg: 0,
      reason: undefined,
      notes: "",
    },
    mode: "onChange",
  });

  const selectedItemId = form.watch("itemId");
  const { data: lots = [], isLoading: lotsLoading } = useInventoryLots(selectedItemId);

  // Reset lot when item changes
  React.useEffect(() => {
    if (selectedItemId) {
      form.setValue("lotId", 0);
    }
  }, [selectedItemId, form]);

  const selectedLotId = form.watch("lotId");
  const selectedLot = lots.find((l: { id: number }) => l.id === Number(selectedLotId));
  const maxKg = selectedLot?.remainingQuantity != null ? selectedLot.remainingQuantity / 1000 : undefined;

  const onSubmit = (values: WastageFormValues) => {
    if (maxKg != null && values.quantityKg > maxKg) {
      form.setError("quantityKg", { message: `الكمية المتاحة في الدفعة ${maxKg.toFixed(2)} كجم كحد أقصى` });
      return;
    }
    const payload: CreateWastageDto = {
      lotId: values.lotId,
      quantityGrams: kgToGrams(values.quantityKg),
      reason: values.reason,
    };
    if (values.notes?.trim()) payload.notes = values.notes.trim();
    createWastage.mutate(payload, {
      onSuccess: () => navigate("/wastage"),
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-4">
        <Link to="/wastage" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">تسجيل هدر</h1>
          <p className="text-muted-foreground mt-1">إضافة سجل هدر أو تلف — اختر الصنف والدفعة والكمية والسبب</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
              <FormField
                control={form.control}
                name="itemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الصنف</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={field.value ? String(field.value) : ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الصنف" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {items.map((item: { id: number; name: string; code?: string }) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.name} {item.code ? `(${item.code})` : ""}
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
                name="lotId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الدفعة</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={field.value ? String(field.value) : ""}
                      disabled={!selectedItemId || lotsLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedItemId ? "اختر الدفعة" : "اختر الصنف أولاً"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {lots.map((lot: { id: number; lotNumber: string; remainingQuantity?: number }) => (
                          <SelectItem key={lot.id} value={String(lot.id)}>
                            دفعة {lot.lotNumber}
                            {lot.remainingQuantity != null
                              ? ` — متبقي ${(lot.remainingQuantity / 1000).toFixed(2)} كجم`
                              : ""}
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
                name="quantityKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الكمية (كجم)</FormLabel>
                    <FormControl>
                      <NumericInput
                        
                        step="0.001"
                        min={0}
                        placeholder="0.000"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                      />
                    </FormControl>
                    {maxKg != null && (
                      <p className="text-xs text-muted-foreground">الحد الأقصى في الدفعة: {maxKg.toFixed(2)} كجم</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>سبب الهدر</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر السبب" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REASON_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
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
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ملاحظات (اختياري)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="أي ملاحظات إضافية" className="min-h-[80px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-3 pt-4">
                <Button type="submit" disabled={createWastage.isPending} className="gap-2">
                  {createWastage.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  حفظ وتسجيل الهدر
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/wastage")}>
                  إلغاء
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
