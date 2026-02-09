import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useInventoryLots } from "@/hooks/use-inventory";
import { Layers, Loader2 } from "lucide-react";
import { InventoryItem } from "@/types/inventory";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

// Correct import for Dialog
import {
    Dialog as ShcnDialog,
    DialogContent as ShcnDialogContent,
    DialogHeader as ShcnDialogHeader,
    DialogTitle as ShcnDialogTitle,
} from "@/components/ui/dialog";

interface InventoryLotsDialogProps {
    item: InventoryItem | null;
    onClose: () => void;
}

export default function InventoryLotsDialog({ item, onClose }: InventoryLotsDialogProps) {
    const { data: lots, isLoading } = useInventoryLots(item?.itemId || 0);

    return (
        <ShcnDialog open={!!item} onOpenChange={(open) => !open && onClose()}>
            <ShcnDialogContent className="sm:max-w-[700px]" dir="rtl">
                <ShcnDialogHeader>
                    <ShcnDialogTitle className="text-right flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" />
                        دفعات المخزون (FIFO): {item?.itemName}
                    </ShcnDialogTitle>
                </ShcnDialogHeader>

                <div className="mt-4">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead className="text-right">رقم الدفعة</TableHead>
                                <TableHead className="text-center">الكمية المتبقية</TableHead>
                                <TableHead className="text-center">سعر الشراء (كغم)</TableHead>
                                <TableHead className="text-right">تاريخ الاستلام</TableHead>
                                <TableHead className="text-right">تاريخ الانتهاء</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                        جاري تحميل الدفعات...
                                    </TableCell>
                                </TableRow>
                            ) : !lots || lots.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                        لا توجد دفعات نشطة لهذا المنتج
                                    </TableCell>
                                </TableRow>
                            ) : (
                                lots.map((lot) => (
                                    <TableRow key={lot.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-mono font-bold text-sm">{lot.lotNumber}</span>
                                                {lot.purchaseNumber && (
                                                    <span className="text-[10px] text-muted-foreground">فاتورة: {lot.purchaseNumber}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col">
                                                <span className="font-bold">{(lot.remainingQuantity / 1000).toFixed(3)}</span>
                                                <span className="text-[10px] text-muted-foreground uppercase">{item?.unitOfMeasure}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-mono">
                                            ₪{(lot.unitPurchasePrice / 1000).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right text-xs">
                                            {format(new Date(lot.receivedAt), "PP", { locale: ar })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {lot.expiryDate ? (
                                                <Badge
                                                    variant={new Date(lot.expiryDate) < new Date() ? "destructive" : "outline"}
                                                    className="text-[10px]"
                                                >
                                                    {format(new Date(lot.expiryDate), "PP", { locale: ar })}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ShcnDialogContent>
        </ShcnDialog>
    );
}
