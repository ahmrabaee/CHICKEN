import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  FileText,
  Loader2,
  Plus,
  User,
  Receipt,
  Calendar,
  Hash,
  ExternalLink,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { PartySearchCombobox } from "@/components/credit-note/PartySearchCombobox";
import { creditNoteService, type CreditNote, type CreateCreditNoteDto } from "@/services/credit-note.service";
import { reconciliationService, type OpenInvoice } from "@/services/reconciliation.service";
import { customerService } from "@/services/customer.service";
import { supplierService } from "@/services/supplier.service";
import { toast } from "@/hooks/use-toast";

function formatCurrency(v: number) {
  return `₪ ${(v / 100).toFixed(2)}`;
}
function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
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

export default function CreditNoteProfile() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isNew = id === "new" || !id;

  const [partyType, setPartyType] = useState<"customer" | "supplier">("customer");
  const [party, setParty] = useState<{ id: number; name: string; phone?: string | null } | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<OpenInvoice | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState("");

  const { data: customers } = useQuery({
    queryKey: ["customers", "credit-note"],
    queryFn: async () => {
      const r = await customerService.getCustomers({ page: 1, pageSize: 500 });
      return r.data ?? [];
    },
    enabled: partyType === "customer",
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", "credit-note"],
    queryFn: async () => {
      const r = await supplierService.getSuppliers({ page: 1, pageSize: 500 });
      return r.data ?? [];
    },
    enabled: partyType === "supplier",
  });

  const { data: openInvoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["reconciliation", "open-invoices", partyType, party?.id],
    queryFn: async () => {
      if (!party?.id) return [];
      const r = await reconciliationService.getOpenInvoices(partyType, party.id);
      return r.data.data ?? [];
    },
    enabled: !!party?.id,
  });

  const { data: creditNote, isLoading: loadingCreditNote } = useQuery({
    queryKey: ["credit-notes", id],
    queryFn: async () => {
      const r = await creditNoteService.getById(Number(id));
      return r.data.data;
    },
    enabled: !isNew && !!id,
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateCreditNoteDto) => creditNoteService.create(dto),
    onSuccess: (res) => {
      toast({ title: "تم إنشاء الإشعار الدائن" });
      queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
      navigate(`/credit-notes/${res.data.data.id}`);
    },
    onError: (e: Error & { response?: { data?: { message?: string; messageAr?: string } } }) => {
      const msg = e.response?.data?.messageAr ?? e.response?.data?.message ?? e.message;
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: (cnId: number) => creditNoteService.submit(cnId),
    onSuccess: () => {
      toast({ title: "تم ترحيل الإشعار الدائن" });
      queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
      queryClient.invalidateQueries({ queryKey: ["credit-notes", id] });
    },
    onError: (e: Error & { response?: { data?: { message?: string; messageAr?: string } } }) => {
      const msg = e.response?.data?.messageAr ?? e.response?.data?.message ?? e.message;
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    },
  });

  const handlePartyTypeChange = (v: "customer" | "supplier") => {
    setPartyType(v);
    setParty(null);
    setSelectedInvoice(null);
    setAmount(0);
  };

  const handlePartySelect = (p: { id: number; name: string; phone?: string | null } | null) => {
    setParty(p);
    setSelectedInvoice(null);
    setAmount(0);
  };

  const handleCreate = () => {
    if (!selectedInvoice) {
      toast({ title: "اختر الفاتورة", variant: "destructive" });
      return;
    }
    const amountMinor = Math.round(amount * 100);
    if (amountMinor <= 0) {
      toast({ title: "أدخل المبلغ", variant: "destructive" });
      return;
    }
    if (amountMinor > selectedInvoice.outstandingAmount) {
      toast({
        title: "المبلغ يتجاوز المستحق",
        description: `الحد الأقصى: ${formatCurrency(selectedInvoice.outstandingAmount)}`,
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      originalInvoiceType: selectedInvoice.voucherType,
      originalInvoiceId: selectedInvoice.voucherId,
      amount: amountMinor,
      reason: reason.trim() || undefined,
    });
  };

  const handleFullAmount = () => {
    if (selectedInvoice) setAmount(selectedInvoice.outstandingAmount / 100);
  };

  if (!isNew && loadingCreditNote) {
    return (
      <div className="flex justify-center py-24" dir="rtl">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isNew && !creditNote) {
    return (
      <div className="space-y-6" dir="rtl">
        <p className="text-muted-foreground">الإشعار غير موجود</p>
        <Button variant="outline" onClick={() => navigate("/credit-notes")}>
          <ArrowRight className="w-4 h-4 ml-2" /> العودة للقائمة
        </Button>
      </div>
    );
  }

  if (!isNew && creditNote) {
    const cn = creditNote as CreditNote;
    const invoiceLabel =
      cn.originalInvoiceType === "sale"
        ? `بيع #${cn.originalInvoiceId}`
        : `شراء #${cn.originalInvoiceId}`;
    return (
      <div className="space-y-6" dir="rtl">
        <div className="flex justify-between items-start">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/credit-notes")}
              className="mb-2"
            >
              <ArrowRight className="w-4 h-4 ml-2" /> العودة للقائمة
            </Button>
            <h1 className="text-2xl font-bold">الإشعار الدائن {cn.creditNoteNumber}</h1>
            <p className="text-muted-foreground mt-1">
              إشعار دائن على {invoiceLabel}
            </p>
          </div>
          <div className="flex gap-2">
            {cn.docstatus === 0 && (
              <Button
                onClick={() => submitMutation.mutate(cn.id)}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                ترحيل
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/credit-notes/new")}>
              <Plus className="w-4 h-4 ml-2" /> إنشاء آخر
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" /> تفاصيل الإشعار
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Hash className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">الرقم</p>
                  <p className="font-medium">{cn.creditNoteNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">التاريخ</p>
                  <p className="font-medium">{formatDate(cn.creditNoteDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">الفاتورة</p>
                  <Link
                    to={cn.originalInvoiceType === "sale" ? `/sales/${cn.originalInvoiceId}` : `/purchasing/${cn.originalInvoiceId}`}
                    className="font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    {invoiceLabel}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">المبلغ</p>
                  <p className="font-medium">{formatCurrency(cn.amount)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">الحالة</span>
                <span className="font-medium">{statusLabels[cn.docstatus] ?? cn.docstatus}</span>
              </div>
            </div>
            {cn.reason && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">السبب</p>
                <p className="font-medium">{cn.reason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-start">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/credit-notes")}
            className="mb-2"
          >
            <ArrowRight className="w-4 h-4 ml-2" /> العودة للقائمة
          </Button>
          <h1 className="text-2xl font-bold">إنشاء إشعار دائن</h1>
          <p className="text-muted-foreground mt-1">
            اختر الطرف ثم الفاتورة وأدخل المبلغ
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" /> اختيار الطرف
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            اختر نوع الفاتورة ثم ابحث عن العميل أو المورد
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>نوع الفاتورة</Label>
              <Select
                value={partyType}
                onValueChange={(v) => handlePartyTypeChange(v as "customer" | "supplier")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">فاتورة بيع (عميل)</SelectItem>
                  <SelectItem value="supplier">فاتورة شراء (مورد)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{partyType === "customer" ? "العميل" : "المورد"}</Label>
              <PartySearchCombobox
                partyType={partyType}
                customers={customers}
                suppliers={suppliers}
                value={party}
                onSelect={handlePartySelect}
                placeholder={
                  partyType === "customer"
                    ? "اختر العميل أو ابحث..."
                    : "اختر المورد أو ابحث..."
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {party && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> الفواتير المفتوحة
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              اختر الفاتورة المراد إنشاء إشعار دائن عليها (مرتبة بالتاريخ)
            </p>
          </CardHeader>
          <CardContent>
            {loadingInvoices ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !openInvoices?.length ? (
              <p className="text-muted-foreground text-center py-8">
                لا توجد فواتير مفتوحة لهذا الطرف
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المجموع</TableHead>
                    <TableHead>المستحق</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openInvoices
                    .sort(
                      (a, b) =>
                        new Date(b.postingDate).getTime() - new Date(a.postingDate).getTime()
                    )
                    .map((inv) => {
                      const isSelected =
                        selectedInvoice?.voucherType === inv.voucherType &&
                        selectedInvoice?.voucherId === inv.voucherId;
                      return (
                        <TableRow
                          key={`${inv.voucherType}-${inv.voucherId}`}
                          className={isSelected ? "bg-primary/5" : "cursor-pointer hover:bg-muted/50"}
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setAmount(0);
                          }}
                        >
                          <TableCell>
                            <div
                              className={`w-4 h-4 rounded-full border-2 ${
                                isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                              }`}
                            />
                          </TableCell>
                          <TableCell className="font-mono">{inv.voucherNumber}</TableCell>
                          <TableCell>{formatDate(inv.postingDate)}</TableCell>
                          <TableCell>{formatCurrency(inv.totalAmount)}</TableCell>
                          <TableCell className="font-medium text-emerald-600">
                            {formatCurrency(inv.outstandingAmount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {selectedInvoice && (
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل الإشعار</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              الفاتورة: {selectedInvoice.voucherNumber} — المستحق:{" "}
              <span className="font-semibold text-primary">
                {formatCurrency(selectedInvoice.outstandingAmount)}
              </span>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>المبلغ (شيكل) *</Label>
                <div className="flex gap-2 mt-1">
                  <NumericInput
                    className="flex-1"
                    step="0.01"
                    value={amount || ""}
                    onChange={(e) => setAmount(parseFloat(e.target.value || "0"))}
                    placeholder="مثال: 50.00"
                  />
                  <Button variant="outline" size="sm" onClick={handleFullAmount}>
                    المبلغ الكامل
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  الحد الأقصى: {formatCurrency(selectedInvoice.outstandingAmount)}
                </p>
              </div>
              <div>
                <Label>السبب (اختياري)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="إرجاع، خصم..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                إنشاء إشعار دائن
              </Button>
              <Button variant="outline" onClick={() => navigate("/credit-notes")}>
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
