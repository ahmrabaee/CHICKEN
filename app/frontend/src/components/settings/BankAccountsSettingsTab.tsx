import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
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
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bankAccountsService, type BankAccount, type CreateBankAccountDto } from "@/services/bank-accounts.service";
import { useAccounts } from "@/hooks/use-accounting";
import { Account } from "@/types/accounting";
import { toast } from "sonner";

const BANK_ACCOUNTS_QUERY_KEY = ["bank-accounts", "settings"] as const;

const fetchBankAccounts = async () => {
  const res = await bankAccountsService.getAll(true);
  return res.data?.data ?? res.data ?? [];
};

export function BankAccountsSettingsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CreateBankAccountDto & { id?: number }>({
    name: "",
    accountId: 0,
    isDefault: false,
  });

  const { data: bankAccountsRes, isLoading } = useQuery({
    queryKey: BANK_ACCOUNTS_QUERY_KEY,
    queryFn: fetchBankAccounts,
  });

  const { data: accountsData } = useAccounts(true);
  const accounts = (accountsData?.data || accountsData || []) as Account[];
  const postableAccounts = accounts.filter((a) => !a.isGroup);

  const bankAccounts = (Array.isArray(bankAccountsRes) ? bankAccountsRes : []) as BankAccount[];

  const createMutation = useMutation({
    mutationFn: (dto: CreateBankAccountDto) => bankAccountsService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_ACCOUNTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast.success("تم إضافة الحساب البنكي بنجاح");
      setShowForm(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { messageAr?: string } } })?.response?.data?.messageAr ?? "فشل الإضافة";
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: { name?: string; accountId?: number; isDefault?: boolean } }) =>
      bankAccountsService.update(id, dto),
    onSuccess: async (response) => {
      setShowForm(false);
      setEditingId(null);
      resetForm();
      toast.success("تم التحديث بنجاح");
      const updated = (response as { data?: { data?: BankAccount } })?.data?.data;
      if (updated) {
        queryClient.setQueryData(BANK_ACCOUNTS_QUERY_KEY, (old: BankAccount[] | undefined) => {
          if (!Array.isArray(old)) return old;
          return old.map((b) =>
            b.id === updated.id
              ? { ...b, ...updated }
              : { ...b, isDefault: updated.isDefault ? false : b.isDefault }
          );
        });
      }
      await queryClient.refetchQueries({ queryKey: BANK_ACCOUNTS_QUERY_KEY });
      await queryClient.refetchQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { messageAr?: string } } })?.response?.data?.messageAr ?? "فشل التحديث";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bankAccountsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_ACCOUNTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast.success("تم الحذف بنجاح");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { messageAr?: string } } })?.response?.data?.messageAr ?? "فشل الحذف";
      toast.error(msg);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      accountId: 0,
      isDefault: false,
    });
  };

  const handleEdit = (b: BankAccount) => {
    setFormData({
      name: b.name,
      accountId: b.accountId,
      isDefault: b.isDefault,
    });
    setEditingId(b.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.accountId) {
      toast.error("الاسم والحساب مطلوبان");
      return;
    }
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        dto: { name: formData.name, accountId: formData.accountId, isDefault: formData.isDefault },
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        accountId: formData.accountId,
        isDefault: formData.isDefault,
      });
    }
  };

  return (
    <Card dir="rtl" className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          الحسابات البنكية
        </CardTitle>
        <CardDescription>
          إدارة حسابات البنوك المرتبطة بدليل الحسابات. عند اختيار "تحويل بنكي" في الدفعات، اختر الحساب البنكي المناسب.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          إضافة حساب بنكي
        </Button>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">الرمز</TableHead>
                <TableHead className="text-center">الاسم</TableHead>
                <TableHead className="text-center">الحساب (دليل الحسابات)</TableHead>
                <TableHead className="text-center">افتراضي</TableHead>
                <TableHead className="text-center">الحالة</TableHead>
                <TableHead className="w-[100px] text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bankAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    لا توجد حسابات بنكية. أضف حساباً للتعامل مع التحويلات البنكية.
                  </TableCell>
                </TableRow>
              ) : (
                bankAccounts.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-center">{b.code}</TableCell>
                    <TableCell className="text-center">{b.name}</TableCell>
                    <TableCell className="text-center">{b.account ? `${b.account.code} - ${b.account.name}` : "—"}</TableCell>
                    <TableCell className="text-center">{b.isDefault ? "نعم" : "—"}</TableCell>
                    <TableCell className="text-center">{b.isActive ? "نشط" : "معطل"}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-2 justify-center">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(b)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("هل تريد حذف هذا الحساب البنكي؟")) {
                              deleteMutation.mutate(b.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل حساب بنكي" : "إضافة حساب بنكي"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>الاسم *</Label>
                <Input
                  placeholder="مثال: بنك فلسطين"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>الحساب في دليل الحسابات *</Label>
                <Select
                  value={formData.accountId ? String(formData.accountId) : ""}
                  onValueChange={(v) => setFormData((f) => ({ ...f, accountId: parseInt(v, 10) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحساب" />
                  </SelectTrigger>
                  <SelectContent>
                    {postableAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.code} - {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isDefault}
                  onCheckedChange={(v) => setFormData((f) => ({ ...f, isDefault: v }))}
                />
                <Label>افتراضي للتحويلات البنكية</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                إلغاء
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                )}
                {editingId ? "حفظ" : "إضافة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
