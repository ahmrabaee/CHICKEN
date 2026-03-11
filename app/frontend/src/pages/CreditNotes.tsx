import { Link, useNavigate } from "react-router-dom";
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
import { creditNoteService, type CreditNote } from "@/services/credit-note.service";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["credit-notes"],
    queryFn: async () => {
      const r = await creditNoteService.getAll({ page: 1, pageSize: 50 });
      return r.data.data;
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

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">الإشعارات الدائنة</h1>
          <p className="text-muted-foreground mt-1">إدارة إشعارات الخصم والإرجاع المرتبطة بالعمليات المالية.</p>
        </div>
        <Button asChild>
          <Link to="/credit-notes/new">
            <Plus className="w-4 h-4 ml-2" /> إنشاء إشعار دائن
          </Link>
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
                  <TableHead className="text-center">الرقم</TableHead>
                  <TableHead className="text-center">التاريخ</TableHead>
                  <TableHead className="text-center">الفاتورة</TableHead>
                  <TableHead className="text-center">المبلغ</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead className="text-center w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((cn: CreditNote) => (
                  <TableRow
                    key={cn.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/credit-notes/${cn.id}`)}
                  >
                    <TableCell className="text-center font-medium">{cn.creditNoteNumber}</TableCell>
                    <TableCell className="text-center">{formatDate(cn.creditNoteDate)}</TableCell>
                    <TableCell className="text-center">
                      {cn.originalInvoiceType === "sale" ? "بيع" : "شراء"} #{cn.originalInvoiceId}
                    </TableCell>
                    <TableCell className="text-center">{formatCurrency(cn.amount)}</TableCell>
                    <TableCell className="text-center">{statusLabels[cn.docstatus] ?? cn.docstatus}</TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      {cn.docstatus === 0 && (
                        <div className="flex justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => submitMutation.mutate(cn.id)}
                          disabled={submitMutation.isPending}
                        >
                          ترحيل
                        </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
