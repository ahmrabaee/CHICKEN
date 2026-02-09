
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdjustStock } from "@/hooks/use-inventory";
import { Loader2, Settings2 } from "lucide-react";
import { InventoryItem } from "@/types/inventory";

const adjustSchema = z.object({
    adjustmentType: z.enum(["increase", "decrease"]),
    quantity: z.string().min(1, "الكمية مطلوبة"),
    reason: z.string().min(5, "يجب إدخال سبب التعديل (5 أحرف على الأقل)"),
    costPerUnit: z.string().optional(),
    expiryDate: z.string().optional(),
    storageLocation: z.string().optional(),
});

type AdjustValues = z.infer<typeof adjustSchema>;

interface AdjustStockDialogProps {
    item: InventoryItem | null;
    onClose: () => void;
}

export default function AdjustStockDialog({ item, onClose }: AdjustStockDialogProps) {
    const adjustMutation = useAdjustStock();

    const form = useForm<AdjustValues>({
        resolver: zodResolver(adjustSchema),
        defaultValues: {
            adjustmentType: "increase",
            quantity: "",
            reason: "",
            costPerUnit: "",
            expiryDate: "",
            storageLocation: "",
        },
    });

    const adjustmentType = form.watch("adjustmentType");

    const onSubmit = (data: AdjustValues) => {
        if (!item) return;

        const quantityKg = parseFloat(data.quantity);
        adjustMutation.mutate({
            itemId: item.itemId,
            branchId: item.branchId,
            adjustmentType: data.adjustmentType,
            quantityGrams: Math.round(quantityKg * 1000),
            reason: data.reason,
            unitCost: data.costPerUnit ? Math.round(parseFloat(data.costPerUnit) * 1000) : undefined,
            expiryDate: data.expiryDate || undefined,
            storageLocation: data.storageLocation || undefined,
        }, {
            onSuccess: () => {
                onClose();
                form.reset();
            }
        });
    };

    return (
        <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-primary" />
                        تسوية مخزون: {item?.itemName}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="adjustmentType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>نوع التعديل</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger dir="rtl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent dir="rtl">
                                                <SelectItem value="increase">إضافة (جرد زائد)</SelectItem>
                                                <SelectItem value="decrease">خصم (جرد ناقص/تلف)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>الكمية ({item?.unitOfMeasure})</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.001" placeholder="0.000" {...field} className="text-right font-mono" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {adjustmentType === "increase" && (
                            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <FormField
                                    control={form.control}
                                    name="costPerUnit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">سعر التكلفة للإضافة (NIS/KG) — اختياري</FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.01" placeholder="0.00" {...field} className="text-right h-8 text-sm" />
                                            </FormControl>
                                            <p className="text-[11px] text-muted-foreground">يحدد قيمة الكمية المضافة ويُنشئ دفعة للمحاسبة (FIFO)</p>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="expiryDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">تاريخ الانتهاء</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} className="text-right h-8 text-sm" />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>سبب التسوية</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="مثلاً: جرد دوري، معالجة تلف، تصحيح خطأ إدخال..."
                                            {...field}
                                            className="text-right min-h-[80px]"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-start gap-3 pt-2">
                            <Button type="submit" className="w-full" disabled={adjustMutation.isPending}>
                                {adjustMutation.isPending ? (
                                    <>
                                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                        جاري المعالجة...
                                    </>
                                ) : (
                                    "تحديث المخزون"
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
