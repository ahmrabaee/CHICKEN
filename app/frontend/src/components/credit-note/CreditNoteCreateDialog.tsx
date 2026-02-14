import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { creditNoteService } from "@/services/credit-note.service";
import { reconciliationService } from "@/services/reconciliation.service";
import { toast } from "@/hooks/use-toast";

interface CreditNoteCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  originalInvoiceType: "sale" | "purchase";
  originalInvoiceId: number;
}

function formatCurrency(v: number) {
  return `₪ ${(v / 100).toFixed(2)}`;
}

export function CreditNoteCreateDialog({
  open,
  onClose,
  onSuccess,
  originalInvoiceType,
  originalInvoiceId,
}: CreditNoteCreateDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [outstanding, setOutstanding] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !originalInvoiceId) return;
    const fetchOutstanding = async () => {
      try {
        const fn =
          originalInvoiceType === "sale"
            ? reconciliationService.getSaleOutstanding(originalInvoiceId)
            : reconciliationService.getPurchaseOutstanding(originalInvoiceId);
        const r = await fn;
        const val = r.data?.data ?? r.data;
        setOutstanding(typeof val === "number" ? val : 0);
      } catch {
        setOutstanding(0);
      }
    };
    fetchOutstanding();
  }, [open, originalInvoiceId, originalInvoiceType]);

  const createMutation = useMutation({
    mutationFn: (dto: {
      originalInvoiceType: "sale" | "purchase";
      originalInvoiceId: number;
      amount: number;
      reason?: string;
    }) => creditNoteService.create(dto),
    onSuccess: () => {
      toast({ title: "تم إنشاء الإشعار الدائن" });
      queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      onSuccess?.();
      onClose();
      setAmount(0);
      setReason("");
    },
    onError: (e: Error & { response?: { data?: { code?: string; message?: string } } }) => {
      const msg = e.response?.data?.message ?? e.message;
      toast({ variant: "destructive", title: "خطأ", description: msg });
    },
  });

  const handleSubmit = () => {
    const amountMinor = Math.round(amount * 100);
    if (amountMinor <= 0) {
      toast({ variant: "destructive", title: "أدخل المبلغ" });
      return;
    }
    if (outstanding != null && amountMinor > outstanding) {
      toast({
        variant: "destructive",
        title: "المبلغ يتجاوز المستحق",
        description: `الحد الأقصى: ${formatCurrency(outstanding)}`,
      });
      return;
    }
    createMutation.mutate({
      originalInvoiceType,
      originalInvoiceId,
      amount: amountMinor,
      reason: reason || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إنشاء إشعار دائن</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            لفاتورة {originalInvoiceType === "sale" ? "بيع" : "شراء"} #{originalInvoiceId}
          </p>
          {outstanding != null && (
            <p className="text-sm font-medium">
              المستحق الحالي: <span className="text-primary">{formatCurrency(outstanding)}</span>
            </p>
          )}
          <div>
            <Label>المبلغ (شيكل) *</Label>
            <Input
              type="number"
              step="0.01"
              value={amount || ""}
              onChange={(e) => setAmount(parseFloat(e.target.value || "0"))}
              placeholder="مثال: 50.00"
              className="mt-1"
            />
            {outstanding != null && outstanding > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                الحد الأقصى: {formatCurrency(outstanding)}
              </p>
            )}
          </div>
          <div>
            <Label>السبب (اختياري)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="إرجاع، خصم..."
              className="mt-1"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              إنشاء
            </Button>
            <Button variant="outline" onClick={onClose}>
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
