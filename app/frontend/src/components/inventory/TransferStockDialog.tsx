
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
import { NumericInput } from "@/components/ui/numeric-input";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useTransferStock, useItems } from "@/hooks/use-inventory";
import { Loader2, ArrowLeftRight } from "lucide-react";
import { InventoryItem, InventoryLot } from "@/types/inventory";

const transferSchema = z.object({
    fromLotId: z.string().min(1, "يجب تحديد الدفعة المصدر"),
    toItemId: z.string().min(1, "يجب تحديد المنتج الهدف"),
    quantity: z.string().min(1, "الكمية مطلوبة"),
    reason: z.string().min(5, "يجب إدخال سبب التحويل"),
});

type TransferValues = z.infer<typeof transferSchema>;

interface TransferStockDialogProps {
    item: InventoryItem | null;
    onClose: () => void;
}

export default function TransferStockDialog({ item, onClose }: TransferStockDialogProps) {
    const transferMutation = useTransferStock();
    const { data: itemsResponse } = useItems({ isActive: true });

    const allItems = itemsResponse?.data || [];
    // Exclude the current item from target items
    const targetItems = allItems.filter(i => i.id !== item?.itemId);

    const form = useForm<TransferValues>({
        resolver: zodResolver(transferSchema),
        defaultValues: {
            fromLotId: "",
            toItemId: "",
            quantity: "",
            reason: "تحويل داخلي / تصنيع",
        },
    });

    const onSubmit = (data: TransferValues) => {
        if (!item) return;

        transferMutation.mutate({
            fromLotId: parseInt(data.fromLotId),
            toItemId: parseInt(data.toItemId),
            quantity: parseFloat(data.quantity),
            branchId: item.branchId,
            reason: data.reason,
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
                        <ArrowLeftRight className="w-5 h-5 text-blue-500" />
                        تحويل / تصنيع منتج
                    </DialogTitle>
                    <DialogDescription className="text-right">
                        ستقوم بسحب كمية من منتج <span className="font-bold">{item?.itemName}</span> وإضافتها لمنتج آخر.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                        <FormField
                            control={form.control}
                            name="fromLotId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>الدفعة المصدر (FIFO)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger dir="rtl">
                                                <SelectValue placeholder="اختر الدفعة المتوفرة" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent dir="rtl">
                                            {item?.batches.filter(b => !b.isExpired && b.quantity > 0).map(batch => (
                                                <SelectItem key={batch.lotId} value={batch.lotId.toString()}>
                                                    {batch.lotNumber} ({batch.quantity} {item.unitOfMeasure})
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
                            name="toItemId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>المنتج الهدف (الناتج)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger dir="rtl">
                                                <SelectValue placeholder="اختر المنتج المراد التحويل إليه" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent dir="rtl">
                                            {targetItems.map(i => (
                                                <SelectItem key={i.id} value={i.id.toString()}>
                                                    {i.name} ({i.unitOfMeasure})
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
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>الكمية المراد سحبها ({item?.unitOfMeasure})</FormLabel>
                                    <FormControl>
                                        <NumericInput  step="0.001" placeholder="0.000" {...field} className="text-right font-mono" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>السبب / الملاحظات</FormLabel>
                                    <FormControl>
                                        <Input placeholder="مثلاً: تقطيع، تجهيز طلبية..." {...field} className="text-right" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-start gap-3 pt-2">
                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={transferMutation.isPending}>
                                {transferMutation.isPending ? (
                                    <>
                                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                        جاري التحويل...
                                    </>
                                ) : (
                                    "إتمام التحويل"
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
