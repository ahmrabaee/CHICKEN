import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { reconciliationService, type OpenInvoice, type UnallocatedPayment, type SuggestMatch } from "@/services/reconciliation.service";
import { customerService } from "@/services/customer.service";
import { supplierService } from "@/services/supplier.service";
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

export default function Reconciliation() {
  const queryClient = useQueryClient();
  const [partyType, setPartyType] = useState<"customer" | "supplier">("customer");
  const [partyId, setPartyId] = useState<number | null>(null);
  const [allocations, setAllocations] = useState<
    { paymentId: number; invoiceType: "sale" | "purchase"; invoiceId: number; amount: number }[]
  >([]);

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const r = await customerService.getCustomers({ page: 1, pageSize: 500 });
      return r.data ?? [];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const r = await supplierService.getSuppliers({ page: 1, pageSize: 500 });
      return r.data ?? [];
    },
  });

  const { data: openInvoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["reconciliation", "open-invoices", partyType, partyId],
    queryFn: async () => {
      if (!partyId) return [];
      const r = await reconciliationService.getOpenInvoices(partyType, partyId);
      return r.data.data ?? [];
    },
    enabled: !!partyId,
  });

  const { data: unallocatedPayments, isLoading: loadingPayments } = useQuery({
    queryKey: ["reconciliation", "unallocated", partyType, partyId],
    queryFn: async () => {
      if (!partyId) return [];
      const r = await reconciliationService.getUnallocatedPayments(partyType, partyId);
      return r.data.data ?? [];
    },
    enabled: !!partyId,
  });

  const { data: suggests, isLoading: loadingSuggest, refetch: refetchSuggest } = useQuery({
    queryKey: ["reconciliation", "suggest", partyType, partyId],
    queryFn: async () => {
      if (!partyId) return [];
      const r = await reconciliationService.getSuggest(partyType, partyId);
      return r.data.data ?? [];
    },
    enabled: !!partyId,
  });

  const applyMutation = useMutation({
    mutationFn: (body: { partyType: "customer" | "supplier"; partyId: number; allocations: typeof allocations }) =>
      reconciliationService.apply(body),
    onSuccess: () => {
      toast({ title: "تم تطبيق التخصيصات بنجاح" });
      setAllocations([]);
      queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
    },
    onError: (e: Error & { response?: { data?: { code?: string; message?: string; messageAr?: string } } }) => {
      const d = e.response?.data;
      const desc = d?.messageAr ?? d?.message ?? e.message;
      toast({ title: "خطأ في التطبيق", description: desc, variant: "destructive" });
    },
  });

  const parties = partyType === "customer" ? (customers as { id: number; name: string }[]) ?? [] : (suppliers as { id: number; name: string }[]) ?? [];

  const handleAutoMatch = () => {
    if (!suggests?.length || !partyId) return;
    const allocs = suggests.map((s) => ({
      paymentId: s.paymentId,
      invoiceType: s.invoiceType,
      invoiceId: s.invoiceId,
      amount: s.amount,
    }));
    setAllocations(allocs);
  };

  const handleApply = () => {
    if (!partyId || !allocations.length) {
      toast({ title: "حدد التخصيصات أولاً", variant: "destructive" });
      return;
    }
    applyMutation.mutate({ partyType, partyId, allocations });
  };

  const updateAllocAmount = (idx: number, amount: number) => {
    setAllocations((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], amount };
      return next;
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">مطابقة الدفعات</h1>
        <p className="text-muted-foreground mt-1">عرض وربط الدفعات غير المخصصة بالفواتير المستحقة.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>اختر الطرف</CardTitle>
          <div className="flex flex-wrap gap-4 mt-4">
            <Select value={partyType} onValueChange={(v) => { setPartyType(v as "customer" | "supplier"); setPartyId(null); }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">زبون</SelectItem>
                <SelectItem value="supplier">مورد</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={partyId?.toString() ?? ""}
              onValueChange={(v) => setPartyId(v ? parseInt(v, 10) : null)}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder={partyType === "customer" ? "اختر الزبون" : "اختر المورد"} />
              </SelectTrigger>
              <SelectContent>
                {parties.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name} #{p.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {partyId && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>فواتير مفتوحة</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingInvoices ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
                ) : !openInvoices?.length ? (
                  <p className="text-muted-foreground text-center py-6">لا توجد فواتير مفتوحة</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفاتورة</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>المجموع</TableHead>
                        <TableHead>المستحق</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openInvoices.map((inv: OpenInvoice) => (
                        <TableRow key={`${inv.voucherType}-${inv.voucherId}`}>
                          <TableCell>{inv.voucherNumber}</TableCell>
                          <TableCell>{formatDate(inv.postingDate)}</TableCell>
                          <TableCell>{formatCurrency(inv.totalAmount)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(inv.outstandingAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>دفعات غير مخصصة</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPayments ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
                ) : !unallocatedPayments?.length ? (
                  <p className="text-muted-foreground text-center py-6">لا توجد دفعات غير مخصصة</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الدفعة</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>غير مخصص</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unallocatedPayments.map((p: UnallocatedPayment) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.paymentNumber}</TableCell>
                          <TableCell>{formatDate(p.paymentDate)}</TableCell>
                          <TableCell>{formatCurrency(p.amount)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(p.unallocatedAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>اقتراح المطابقات</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchSuggest()} disabled={loadingSuggest}>
                  <RefreshCw className="w-4 h-4 ml-2" /> تحديث
                </Button>
                <Button size="sm" onClick={handleAutoMatch} disabled={!suggests?.length}>
                  <Zap className="w-4 h-4 ml-2" /> تطبيق الكل
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSuggest ? (
                <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
              ) : !suggests?.length ? (
                <p className="text-muted-foreground text-center py-6">لا توجد اقتراحات مطابقة</p>
              ) : allocations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الدفعة</TableHead>
                      <TableHead>الفاتورة</TableHead>
                      <TableHead>المبلغ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations.map((a, idx) => (
                      <TableRow key={idx}>
                        <TableCell>#{a.paymentId}</TableCell>
                        <TableCell>{a.invoiceType === "sale" ? "SAL" : "PUR"}-{a.invoiceId}</TableCell>
                        <TableCell>
                          <NumericInput
                            
                            value={a.amount / 100}
                            onChange={(e) => updateAllocAmount(idx, Math.round(parseFloat(e.target.value || "0") * 100))}
                            className="w-24"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الدفعة</TableHead>
                      <TableHead>الفاتورة</TableHead>
                      <TableHead>المبلغ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggests.map((s: SuggestMatch, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{s.paymentNumber}</TableCell>
                        <TableCell>{s.invoiceNumber}</TableCell>
                        <TableCell>{formatCurrency(s.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {allocations.length > 0 && (
                <div className="mt-4">
                  <Button onClick={handleApply} disabled={applyMutation.isPending}>
                    {applyMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                    تطبيق التخصيصات
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
