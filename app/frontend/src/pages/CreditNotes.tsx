import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { creditNoteService, type CreditNote, type CreateCreditNoteDto } from "@/services/credit-note.service";
import { toast } from "@/hooks/use-toast";

function formatCurrency(v: number) {
  return `₪ ${(v / 100).toFixed(2)}`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const statusLabels: Record<number, string> = {
  0: "مسودة",
  1: "مرحّل",
  2: "ملغى",
};

export default function CreditNotes() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateCreditNoteDto>({
    originalInvoiceType: "sale",
    originalInvoiceId: 0,
    amount: 0,
    reason: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["credit-notes"],
    queryFn: async () => {
      const r = await creditNoteService.getAll({ page: 1, pageSize: 50 });
      return r.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateCreditNoteDto) => creditNoteService.create(dto),
    onSuccess: () => {
      toast({ title: "تم إنشاء الإشعار الدائن" });
      setShowCreate(false);
      setForm({ originalInvoiceType: "sale", originalInvoiceId: 0, amount: 0, reason: "" });
      queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
    },
    onError: (e: Error) => {
      toast({
        title: "خطأ",
        description: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? e.message,
        variant: "destructive",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => creditNoteService.submit(id),
    onSuccess: () => {
      toast({ title: "تم ترحيل الإشعار الدائن" });
      queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
    },
    onError: (e: Error) => {
      toast({
        title: "خطأ",
        description: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? e.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    // form.amount is already in minor units (set in Input onChange)
    if (!form.originalInvoiceId || form.amount <= 0) {
      toast({ title: "أدخل البيانات المطلوبة", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      originalInvoiceType: form.originalInvoiceType,
      originalInvoiceId: form.originalInvoiceId,
      amount: form.amount,
      reason: form.reason || undefined,
    });
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">الإشعارات الدائنة</h1>
          <p className="text-muted-foreground mt-1">إدارة إشعارات الخصم والإرجاع (Blueprint 04)</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 ml-2" /> إنشاء إشعار دائن
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> قائمة الإشعارات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !items.length ? (
            <p className="text-muted-foreground text-center py-12">لا توجد إشعارات دائنة</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرقم</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الفاتورة</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((cn: CreditNote) => (
                  <TableRow key={cn.id}>
                    <TableCell>{cn.creditNoteNumber}</TableCell>
                    <TableCell>{formatDate(cn.creditNoteDate)}</TableCell>
                    <TableCell>
                      {cn.originalInvoiceType === "sale" ? "بيع" : "شراء"} #{cn.originalInvoiceId}
                    </TableCell>
                    <TableCell>{formatCurrency(cn.amount)}</TableCell>
                    <TableCell>{statusLabels[cn.docstatus] ?? cn.docstatus}</TableCell>
                    <TableCell>
                      {cn.docstatus === 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => submitMutation.mutate(cn.id)}
                          disabled={submitMutation.isPending}
                        >
                          ترحيل
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إنشاء إشعار دائن</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>نوع الفاتورة</Label>
              <Select
                value={form.originalInvoiceType}
                onValueChange={(v) => setForm((p) => ({ ...p, originalInvoiceType: v as "sale" | "purchase" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">فاتورة بيع</SelectItem>
                  <SelectItem value="purchase">فاتورة شراء</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>رقم الفاتورة (ID)</Label>
              <Input
                type="number"
                value={form.originalInvoiceId || ""}
                onChange={(e) => setForm((p) => ({ ...p, originalInvoiceId: parseInt(e.target.value || "0", 10) }))}
                placeholder="مثال: 5"
              />
            </div>
            <div>
              <Label>المبلغ (شيكل)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount ? form.amount / 100 : ""}
                onChange={(e) => setForm((p) => ({ ...p, amount: Math.round(parseFloat(e.target.value || "0") * 100) }))}
                placeholder="مثال: 50.00"
              />
            </div>
            <div>
              <Label>السبب (اختياري)</Label>
              <Input
                value={form.reason ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="إرجاع، خصم..."
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                إنشاء
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
