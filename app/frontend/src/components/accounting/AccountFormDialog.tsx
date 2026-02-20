import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateAccount, useUpdateAccount } from "@/hooks/use-accounting";
import { ACCOUNT_TYPES } from "@/lib/accounting";
import type { Account, CreateAccountDto } from "@/types/accounting";

interface AccountFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: "create" | "edit";
    account?: Account | null;
    parentAccounts: Account[];
    onSuccess?: (newAccount?: Account) => void;
    onRefetch?: () => void | Promise<void>;
}

const defaultValues: CreateAccountDto = {
    code: "",
    name: "",
    accountType: "Other",
    parentId: null,
    isGroup: false,
};

export function AccountFormDialog({
    open,
    onOpenChange,
    mode,
    account,
    parentAccounts,
    onSuccess,
    onRefetch,
}: AccountFormDialogProps) {
    const [code, setCode] = useState(defaultValues.code);
    const [name, setName] = useState(defaultValues.name);
    const [nameEn, setNameEn] = useState("");
    const [accountType, setAccountType] = useState<string>(defaultValues.accountType);
    const [parentId, setParentId] = useState<number | null>(null);
    const [isGroup, setIsGroup] = useState(defaultValues.isGroup);
    const [isActive, setIsActive] = useState(true);
    const [freezeAccount, setFreezeAccount] = useState(false);
    const [balanceMustBe, setBalanceMustBe] = useState<string>("__none");
    const [accountCurrency, setAccountCurrency] = useState("");

    const createMutation = useCreateAccount();
    const updateMutation = useUpdateAccount();
    const isPending = createMutation.isPending || updateMutation.isPending;

    useEffect(() => {
        if (open) {
            if (mode === "edit" && account) {
                setCode(account.code);
                setName(account.name);
                setNameEn(account.nameEn ?? "");
                setAccountType(account.accountType || "Other");
                setParentId(account.parentId ?? null);
                setIsGroup(account.isGroup ?? false);
                setIsActive(account.isActive ?? true);
                setFreezeAccount(account.freezeAccount ?? false);
                setBalanceMustBe(account.balanceMustBe ?? "__none");
                setAccountCurrency(account.accountCurrency ?? "");
            } else {
                setCode(defaultValues.code);
                setName(defaultValues.name);
                setNameEn("");
                setAccountType(defaultValues.accountType);
                setParentId(defaultValues.parentId ?? null);
                setIsGroup(defaultValues.isGroup);
                setIsActive(true);
                setFreezeAccount(false);
                setBalanceMustBe("__none");
                setAccountCurrency("");
            }
        }
    }, [open, mode, account]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const balanceVal = balanceMustBe === "__none" ? undefined : balanceMustBe as "Debit" | "Credit";
        if (mode === "create") {
            createMutation.mutate(
                {
                    code,
                    name,
                    nameEn: nameEn || undefined,
                    accountType,
                    parentId: parentId || undefined,
                    isGroup,
                    balanceMustBe: balanceVal,
                    accountCurrency: accountCurrency || undefined,
                },
                {
                    onSuccess: async (newAccount) => {
                        await onRefetch?.();
                        onOpenChange(false);
                        onSuccess?.(newAccount);
                    },
                }
            );
        } else if (account) {
            updateMutation.mutate(
                {
                    id: account.id,
                    data: {
                        name,
                        nameEn: nameEn || undefined,
                        accountType,
                        parentId: parentId ?? undefined,
                        isGroup,
                        isActive,
                        freezeAccount,
                        balanceMustBe: balanceVal,
                        accountCurrency: accountCurrency || undefined,
                    },
                },
                {
                    onSuccess: async (updatedAccount) => {
                        await onRefetch?.();
                        onOpenChange(false);
                        onSuccess?.(updatedAccount);
                    },
                }
            );
        }
    };

    const groupAccounts = parentAccounts.filter((a) => a.isGroup);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md sm:max-w-lg" dir="rtl">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "create" ? "إضافة حساب جديد" : "تعديل الحساب"}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">كود الحساب</Label>
                                <Input
                                    id="code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="مثال: 1199"
                                    required
                                    disabled={mode === "edit"}
                                    className="font-mono"
                                />
                                {mode === "edit" && (
                                    <p className="text-xs text-muted-foreground">لا يمكن تغيير الكود بعد الإنشاء</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">اسم الحساب</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="اسم الحساب"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="nameEn">الاسم بالإنجليزية</Label>
                            <Input
                                id="nameEn"
                                value={nameEn}
                                onChange={(e) => setNameEn(e.target.value)}
                                placeholder="Account name in English"
                                dir="ltr"
                                className="text-left"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="accountType">نوع الحساب</Label>
                            <Select value={accountType} onValueChange={setAccountType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر النوع" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ACCOUNT_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="parentId">الحساب الأب</Label>
                            <Select
                                value={parentId ? String(parentId) : "__none"}
                                onValueChange={(v) => setParentId(v === "__none" ? null : Number(v))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="بدون (جذر)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none">بدون (جذر)</SelectItem>
                                    {groupAccounts.map((a) => (
                                        <SelectItem key={a.id} value={String(a.id)}>
                                            {a.code} — {a.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="balanceMustBe">اتجاه الرصيد</Label>
                                <Select value={balanceMustBe} onValueChange={setBalanceMustBe}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="بدون تقييد" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none">بدون تقييد</SelectItem>
                                        <SelectItem value="Debit">مدين فقط</SelectItem>
                                        <SelectItem value="Credit">دائن فقط</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accountCurrency">عملة الحساب</Label>
                                <Input
                                    id="accountCurrency"
                                    value={accountCurrency}
                                    onChange={(e) => setAccountCurrency(e.target.value.toUpperCase())}
                                    placeholder="مثال: SAR"
                                    maxLength={3}
                                    dir="ltr"
                                    className="font-mono text-left"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <Label htmlFor="isGroup">حساب مجموعة (لا يُستخدم في القيود)</Label>
                            <Switch
                                id="isGroup"
                                checked={isGroup}
                                onCheckedChange={setIsGroup}
                            />
                        </div>

                        {mode === "edit" && (
                            <>
                                <div className="flex items-center justify-between gap-4">
                                    <Label htmlFor="isActive">نشط</Label>
                                    <Switch
                                        id="isActive"
                                        checked={isActive}
                                        onCheckedChange={setIsActive}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <Label htmlFor="freezeAccount">حساب مجمد</Label>
                                    <Switch
                                        id="freezeAccount"
                                        checked={freezeAccount}
                                        onCheckedChange={setFreezeAccount}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                            {mode === "create" ? "إنشاء" : "حفظ"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
