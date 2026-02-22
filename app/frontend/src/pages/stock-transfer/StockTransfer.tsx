import { useState } from "react";
import { Plus, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { useStockTransfers, useStockTransfer } from "@/hooks/use-stock-transfer";
import type { StockTransfer as StockTransferType } from "@/services/stock-transfer.service";

function formatCurrency(v: number) {
  return `₪ ${(v / 100).toFixed(2)}`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function formatWeight(g: number) {
  return `${(g / 1000).toFixed(2)} كجم`;
}

function TransferDetailDialog({
  transferId,
  open,
  onClose,
}: {
  transferId: number;
  open: boolean;
  onClose: () => void;
}) {
  const { data: transfer, isLoading } = useStockTransfer(transferId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">تفاصيل تحويل المخزون</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : transfer ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Info label="رقم التحويل" value={transfer.transferNumber} />
              <Info label="التاريخ" value={formatDate(transfer.transferDate)} />
              <Info label="تاريخ الصلاحية" value={formatDate(transfer.expiryDate)} />
              <Info label="الوزن الإجمالي" value={formatWeight(transfer.totalWeightGrams)} />
              <Info label="التكلفة الإجمالية" value={formatCurrency(transfer.totalCostValue)} highlight />
              <Info label="الحالة" value={transfer.status} />
              <Info label="المصدر" value={transfer.sourceLot?.lotNumber ?? "—"} />
              <Info label="أمر الشراء" value={transfer.sourceLot?.purchase?.purchaseNumber ?? "—"} />
            </div>
            {transfer.lines && transfer.lines.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">تفاصيل التوزيع</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead className="text-center">التكلفة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfer.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.item?.name ?? "—"}</TableCell>
                        <TableCell className="text-center">{formatWeight(l.weightGrams)}</TableCell>
                        <TableCell className="text-center">{formatCurrency(l.lineCostValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {transfer.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                <p className="text-sm bg-muted/30 rounded-lg p-3">{transfer.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">لم يتم العثور على السجل</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${highlight ? "text-primary text-base" : ""}`}>{value}</p>
    </div>
  );
}

export default function StockTransfer() {
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data, isLoading, error } = useStockTransfers(page, 20);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20) || 1;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">تحويل المخزون</h1>
          <p className="text-muted-foreground mt-1">تحويل دجاج خام إلى منتجات (أجنحة، صدور، إلخ)</p>
        </div>
        <Link to="/stock-transfer/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            تحويل جديد
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-16 text-red-500">
              <p>حدث خطأ في تحميل البيانات</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">لا يوجد تحويلات مسجلة</p>
              <p className="text-sm mt-1">استخدم «تحويل جديد» لتحويل مخزون الدجاج الخام إلى منتجات</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="data-table-header">
                  <TableHead className="text-right">رقم التحويل</TableHead>
                  <TableHead className="text-center">التاريخ</TableHead>
                  <TableHead className="text-center">الوزن</TableHead>
                  <TableHead className="text-center">التكلفة</TableHead>
                  <TableHead className="text-center">صلاحية</TableHead>
                  <TableHead className="text-center w-16">عرض</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(items as StockTransferType[]).map((t) => (
                  <TableRow key={t.id} className="data-table-row">
                    <TableCell>
                      <span className="font-medium">{t.transferNumber}</span>
                    </TableCell>
                    <TableCell className="text-center">{formatDate(t.transferDate)}</TableCell>
                    <TableCell className="text-center">{formatWeight(t.totalWeightGrams)}</TableCell>
                    <TableCell className="text-center font-semibold">{formatCurrency(t.totalCostValue)}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{formatDate(t.expiryDate)}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDetailId(t.id)}
                        title="عرض التفاصيل"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          صفحة {page} من {totalPages} — {total} تحويل
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      </div>

      {detailId !== null && (
        <TransferDetailDialog transferId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
