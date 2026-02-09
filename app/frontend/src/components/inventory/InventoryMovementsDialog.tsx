
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useInventoryMovements } from "@/hooks/use-inventory";
import { History, Loader2, ArrowUpRight, ArrowDownLeft, Settings2, ShoppingCart, Package } from "lucide-react";
import { InventoryItem } from "@/types/inventory";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface InventoryMovementsDialogProps {
    item: InventoryItem | null;
    onClose: () => void;
}

const movementTypes: Record<string, { label: string; icon: any; color: string }> = {
    'purchase': { label: 'شراء', icon: Package, color: 'text-blue-600 bg-blue-50' },
    'sale': { label: 'بيع', icon: ShoppingCart, color: 'text-emerald-600 bg-emerald-50' },
    'adjustment_in': { label: 'تسوية (زيادة)', icon: ArrowUpRight, color: 'text-indigo-600 bg-indigo-50' },
    'adjustment_out': { label: 'تسوية (نقص)', icon: ArrowDownLeft, color: 'text-orange-600 bg-orange-50' },
    'return': { label: 'إرجاع', icon: History, color: 'text-slate-600 bg-slate-50' },
};

export default function InventoryMovementsDialog({ item, onClose }: InventoryMovementsDialogProps) {
    const { data: response, isLoading } = useInventoryMovements(item?.itemId || 0, { pageSize: 10 });
    const movements = response?.data || [];

    return (
        <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[800px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" />
                        سجل الحركات: {item?.itemName}
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead className="text-right">التاريخ</TableHead>
                                <TableHead className="text-right">النوع</TableHead>
                                <TableHead className="text-center">الكمية</TableHead>
                                <TableHead className="text-right">المرجع</TableHead>
                                <TableHead className="text-right">ملاحظات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                        جاري تحميل الحركات...
                                    </TableCell>
                                </TableRow>
                            ) : movements.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                        لا توجد حركات مسجلة لهذا المنتج
                                    </TableCell>
                                </TableRow>
                            ) : (
                                movements.map((m) => {
                                    const type = movementTypes[m.movementType] || { label: m.movementType, icon: Settings2, color: 'text-slate-500 bg-slate-50' };
                                    const Icon = type.icon;
                                    const isPositive = m.quantityGrams > 0;

                                    return (
                                        <TableRow key={m.id}>
                                            <TableCell className="text-right text-xs">
                                                <div className="flex flex-col">
                                                    <span>{format(new Date(m.createdAt), "PP", { locale: ar })}</span>
                                                    <span className="text-muted-foreground">{format(new Date(m.createdAt), "p", { locale: ar })}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className={`flex items-center gap-2 px-2 py-1 rounded-md w-fit ${type.color}`}>
                                                    <Icon className="w-3.5 h-3.5" />
                                                    <span className="text-xs font-medium">{type.label}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-orange-600'}`}>
                                                    {isPositive ? '+' : ''}{(m.quantityGrams / 1000).toFixed(3)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-mono">
                                                {m.referenceType}: {m.referenceId}
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground max-w-[200px] truncate">
                                                {m.reason || m.notes || '—'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
