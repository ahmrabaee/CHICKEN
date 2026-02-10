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
import { useWastageRecords, useWastageRecord } from "@/hooks/use-wastage";
import type { WastageRecord as WastageRecordType } from "@/types/wastage";

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

const reasonLabels: Record<string, string> = {
  expired: "منتهي الصلاحية",
  damaged: "تالف",
  spoiled: "فاسد",
  processing_loss: "فقد تصنيع",
  other: "أخرى",
};

/** Stage 3: Full-detail card — every piece of data from GET /wastage/:id */
function WastageDetailCard({
  recordId,
  open,
  onClose,
}: {
  recordId: number;
  open: boolean;
  onClose: () => void;
}) {
  const { data: record, isLoading } = useWastageRecord(recordId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">تفاصيل سجل الهدر — كل البيانات</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : record ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Info label="المعرف" value={record.id} />
              <Info label="الصنف (معرف)" value={record.itemId} />
              <Info label="اسم الصنف" value={record.item?.name ?? "—"} />
              <Info label="رمز الصنف" value={record.item?.code ?? "—"} />
              <Info label="الدفعة (معرف)" value={record.lotId ?? "—"} />
              <Info label="رقم الدفعة" value={record.lot?.lotNumber ?? "—"} />
              <Info label="الفرع (معرف)" value={record.branchId ?? "—"} />
              <Info label="الكمية (غرام)" value={record.weightGrams} />
              <Info label="الكمية (كجم)" value={(record.weightGrams / 1000).toFixed(2)} />
              <Info label="نوع الهدر" value={record.wastageType} />
              <Info label="السبب" value={reasonLabels[record.reason] ?? record.reason} />
              <Info label="التكلفة المقدرة (فلس)" value={record.estimatedCostValue} />
              <Info label="التكلفة المقدرة" value={formatCurrency(record.estimatedCostValue)} highlight />
              <Info label="رابط الصورة" value={record.photoUrl ?? "—"} />
              <Info label="مسجّل بواسطة (معرف)" value={record.recordedById} />
              <Info label="مسجّل بواسطة" value={record.recordedBy?.fullName ?? "—"} />
              <Info label="معتمد بواسطة (معرف)" value={record.approvedById ?? "—"} />
              <Info label="معتمد بواسطة" value={record.approvedBy?.fullName ?? "—"} />
              <Info label="تاريخ الاعتماد" value={record.approvedAt ? formatDate(record.approvedAt) : "—"} />
              <Info label="تاريخ الهدر" value={formatDate(record.wastageDate)} />
              <Info label="تاريخ الإنشاء" value={formatDate(record.createdAt)} />
              <Info label="تاريخ التحديث" value={formatDate(record.updatedAt)} />
            </div>
            {record.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                <p className="text-sm bg-muted/30 rounded-lg p-3">{record.notes}</p>
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

export default function Wastage() {
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data, isLoading, error } = useWastageRecords({ page, pageSize: 20 });
  const records = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الهدر والتالف</h1>
          <p className="text-muted-foreground mt-1">سجل الهدر والتلف — قائمة وزر عرض التفاصيل الكاملة</p>
        </div>
        <Link to="/wastage/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            تسجيل هدر
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
          ) : records.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">لا يوجد هدر مسجل</p>
              <p className="text-sm mt-1">استخدم «تسجيل هدر» لإنشاء سجل جديد</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="data-table-header">
                  <TableHead className="text-right">الصنف</TableHead>
                  <TableHead className="text-center">الكمية</TableHead>
                  <TableHead className="text-center">التكلفة المقدرة</TableHead>
                  <TableHead className="text-center">السبب</TableHead>
                  <TableHead className="text-center">التاريخ</TableHead>
                  <TableHead className="text-center w-16">عرض</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(records as WastageRecordType[]).map((r) => (
                  <TableRow key={r.id} className="data-table-row">
                    <TableCell>
                      <span className="font-medium">{r.item?.name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground mr-2">{r.item?.code ?? ""}</span>
                    </TableCell>
                    <TableCell className="text-center">{formatWeight(r.weightGrams)}</TableCell>
                    <TableCell className="text-center font-semibold text-red-600 dark:text-red-400">
                      {formatCurrency(r.estimatedCostValue)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs bg-red-100 dark:bg-red-950 text-red-600 px-2 py-0.5 rounded-full">
                        {reasonLabels[r.reason] ?? r.reason}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {formatDate(r.wastageDate)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDetailId(r.id)}
                        title="عرض كل البيانات"
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
          {pagination
            ? `صفحة ${pagination.page} من ${pagination.totalPages} — ${pagination.totalItems} سجل`
            : `${records.length} سجل`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination?.hasPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination?.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      </div>

      {detailId !== null && (
        <WastageDetailCard recordId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
