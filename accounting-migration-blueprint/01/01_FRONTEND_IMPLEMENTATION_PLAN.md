# Blueprint 01 — Frontend Implementation Plan
## Chart of Accounts Rebuild (Nested Set, ERP-Level)

**Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Ready for Implementation

---

## 1. Executive Summary

This document provides a detailed, step-by-step plan to implement frontend changes supporting **Blueprint 01: Chart of Accounts Rebuild**. The backend already implements Nested Set, `rootType`/`reportType`/`isGroup`, `accountId` in journal lines, and `PreventGroupPostingGuard`. The frontend must:

1. **Tree view** for Chart of Accounts with expand/collapse, `rootType` colors, `reportType` badge
2. **Account selection** for Journal Entry / Branch: use `postableOnly=true` to show only ledger accounts (`isGroup=false`)
3. **Delete flow** — call `can-delete` API before delete, show appropriate message
4. **Types & API** — update `Account` interface, use `accountId` instead of `accountCode`, API routes by `id`
5. **Error handling** — POSTING_TO_GROUP_ACCOUNT, POSTING_TO_DISABLED_ACCOUNT, POSTING_TO_FROZEN_ACCOUNT

---

## 2. Implementation Phases

| Phase | Scope | Priority | Est. Time |
|-------|-------|----------|-----------|
| **Phase 1** | Types + Service + Hooks updates | Critical | 1–2 hrs |
| **Phase 2** | Accounting page — Tree component | High | 2–3 hrs |
| **Phase 3** | Postable accounts filter + Branch stock selector | High | 1 hr |
| **Phase 4** | Delete flow + can-delete check | Medium | 1 hr |
| **Phase 5** | Journal entry errors + ledger display | Medium | 30 min |

---

## 3. Phase 1 — Types, Service, Hooks

### 3.1 Types — `src/types/accounting.ts`

**Update `Account` interface:**

```typescript
export interface Account {
    id: number;
    code: string;
    name: string;
    nameEn?: string;
    // Blueprint 01: new fields
    rootType: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
    reportType: 'Balance Sheet' | 'Profit and Loss';
    accountType: string;
    parentId?: number | null;
    lft: number;
    rgt: number;
    isGroup: boolean;
    balanceMustBe?: 'Debit' | 'Credit' | null;
    accountCurrency?: string | null;
    companyId?: number | null;
    isActive: boolean;
    isSystemAccount?: boolean;
    freezeAccount?: boolean;
    parent?: { id: number; code: string; name: string } | null;
    childAccounts?: { id: number; code: string; name: string }[];
    balance?: number;  // optional, if backend provides
    createdAt: string;
    updatedAt: string;
}

export interface CreateAccountDto {
    code: string;
    name: string;
    nameEn?: string;
    rootType?: string;
    reportType?: string;
    accountType: string;
    parentId?: number | null;
    isGroup?: boolean;
    balanceMustBe?: 'Debit' | 'Credit' | null;
}

export interface UpdateAccountDto extends Partial<CreateAccountDto> {
    isActive?: boolean;
    freezeAccount?: boolean;
}

export interface CanDeleteAccountResponse {
    canDelete: boolean;
    hasEntries?: boolean;
    hasChildren?: boolean;
}
```

---

### 3.2 Service — `src/services/accounting.service.ts`

**Update methods:**

```typescript
// Chart of Accounts
async getAccounts(postableOnly?: boolean): Promise<ApiResponse<Account[]>> {
    const params = postableOnly ? { postableOnly: 'true' } : undefined;
    const response = await axiosInstance.get<ApiResponse<Account[]>>('/accounting/accounts', { params });
    return response.data;
},
async getAccountById(id: number): Promise<Account> {
    const response = await axiosInstance.get<ApiResponse<Account>>(`/accounting/accounts/${id}`);
    return response.data.data;
},
async getAccountByCode(code: string): Promise<Account> {
    const response = await axiosInstance.get<ApiResponse<Account>>(`/accounting/accounts/code/${code}`);
    return response.data.data;
},
async createAccount(data: CreateAccountDto): Promise<Account> {
    const response = await axiosInstance.post<ApiResponse<Account>>('/accounting/accounts', data);
    return response.data.data;
},
async updateAccount(id: number, data: UpdateAccountDto): Promise<Account> {
    const response = await axiosInstance.put<ApiResponse<Account>>(`/accounting/accounts/${id}`, data);
    return response.data.data;
},
async deleteAccount(id: number): Promise<void> {
    await axiosInstance.delete(`/accounting/accounts/${id}`);
},
async canDeleteAccount(id: number): Promise<CanDeleteAccountResponse> {
    const response = await axiosInstance.get<ApiResponse<CanDeleteAccountResponse>>(`/accounting/accounts/${id}/can-delete`);
    return response.data.data;
},
async rebuildAccountTree(): Promise<void> {
    await axiosInstance.post('/accounting/accounts/rebuild-tree');
},
```

**Note:** Remove `getAccountByCode` overload that used `accounts/:code` — backend now uses `accounts/code/:code` or `accounts/:id` (id/code backward compatible).

---

### 3.3 Hooks — `src/hooks/use-accounting.ts`

**Add/update:**

```typescript
export const useAccounts = (postableOnly?: boolean) => {
    return useQuery({
        queryKey: ['accounting', 'accounts', postableOnly],
        queryFn: () => accountingService.getAccounts(postableOnly),
    });
};

export const useAccount = (idOrCode: string | number) => {
    return useQuery({
        queryKey: ['accounting', 'accounts', idOrCode],
        queryFn: () =>
            typeof idOrCode === 'number'
                ? accountingService.getAccountById(idOrCode)
                : accountingService.getAccountByCode(idOrCode),
        enabled: idOrCode !== '' && idOrCode != null,
    });
};

export const useCanDeleteAccount = (id: number) => {
    return useQuery({
        queryKey: ['accounting', 'accounts', id, 'can-delete'],
        queryFn: () => accountingService.canDeleteAccount(id),
        enabled: !!id,
    });
};

export const useUpdateAccount = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateAccountDto }) =>
            accountingService.updateAccount(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting', 'accounts'] });
            toast({ title: 'تم تحديث الحساب بنجاح' });
        },
        onError: (error: any) => {
            toast({ variant: 'destructive', title: 'خطأ', description: error.response?.data?.message || 'حدث خطأ' });
        },
    });
};

export const useDeleteAccount = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => accountingService.deleteAccount(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting', 'accounts'] });
            toast({ title: 'تم حذف الحساب بنجاح' });
        },
        onError: (error: any) => {
            const code = error.response?.data?.code;
            const messageAr = error.response?.data?.messageAr;
            if (code === 'POSTING_TO_GROUP_ACCOUNT') {
                toast({ variant: 'destructive', title: 'لا يمكن القيد على حسابات المجموعة', description: messageAr });
                return;
            }
            toast({ variant: 'destructive', title: 'خطأ', description: messageAr || error.response?.data?.message || 'حدث خطأ' });
        },
    });
};
```

**Breaking change:** `useUpdateAccount` previously used `{ code, data }` — now uses `{ id, data }`.

---

## 4. Phase 2 — Accounting Page (Tree Component)

### 4.1 Root type colors

**Add constant — e.g. in `src/pages/Accounting.tsx` or `src/lib/accounting.ts`:**

```typescript
export const ROOT_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    Asset: { bg: 'bg-blue-500/15', text: 'text-blue-700', label: 'أصول' },
    Liability: { bg: 'bg-red-500/15', text: 'text-red-700', label: 'خصوم' },
    Equity: { bg: 'bg-green-500/15', text: 'text-green-700', label: 'حقوق ملكية' },
    Income: { bg: 'bg-amber-500/15', text: 'text-amber-700', label: 'إيرادات' },
    Expense: { bg: 'bg-orange-500/15', text: 'text-orange-700', label: 'مصروفات' },
};

export const REPORT_TYPE_LABELS: Record<string, string> = {
    'Balance Sheet': 'الميزانية',
    'Profit and Loss': 'قائمة الدخل',
};
```

---

### 4.2 Tree view component

**Option A — Simple recursive tree (no extra dependency):**

**Backend returns:** Flat list ordered by `lft`, each with `parent`, `childAccounts`. Build tree client-side from `parentId` or use `lft`/`rgt` to compute depth.

Create `src/components/accounting/AccountTreeRow.tsx`:

```typescript
import { ChevronDown, ChevronLeft, Folder, FileText } from 'lucide-react';
import { TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Account } from '@/types/accounting';
import { ROOT_TYPE_COLORS, REPORT_TYPE_LABELS } from '@/lib/accounting';

interface AccountTreeRowProps {
    account: Account;
    depth?: number;
    expandedIds: Set<number>;
    onToggle: (id: number) => void;
    onEdit?: (account: Account) => void;
    onDelete?: (account: Account) => void;
}

export function AccountTreeRow({
    account,
    depth = 0,
    expandedIds,
    onToggle,
    onEdit,
    onDelete,
}: AccountTreeRowProps) {
    const children = account.childAccounts || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(account.id);
    const style = ROOT_TYPE_COLORS[account.rootType] || { bg: '', text: '', label: '' };

    return (
        <>
            <tr
                className="data-table-row hover:bg-muted/50"
                style={{ paddingRight: depth * 24 }}
            >
                <TableCell className="align-middle">
                    <div className="flex items-center gap-1" style={{ paddingRight: depth * 16 }}>
                        {hasChildren ? (
                            <button onClick={() => onToggle(account.id)} className="p-0.5">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4 rotate-[-90deg]" />}
                            </button>
                        ) : (
                            <span className="w-5 inline-block" />
                        )}
                        {account.isGroup ? <Folder className="w-4 h-4 text-muted-foreground" /> : <FileText className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-mono text-sm">{account.code}</span>
                    </div>
                </TableCell>
                <TableCell className="font-medium">{account.name}</TableCell>
                <TableCell>
                    <Badge variant="outline" className={`text-xs ${style.bg} ${style.text}`}>
                        {style.label}
                    </Badge>
                </TableCell>
                <TableCell>
                    <span className="text-xs text-muted-foreground">{REPORT_TYPE_LABELS[account.reportType] || account.reportType}</span>
                </TableCell>
                <TableCell>
                    {account.isGroup ? (
                        <Badge variant="secondary">مجموعة</Badge>
                    ) : (
                        <Badge variant="outline">دفتر</Badge>
                    )}
                </TableCell>
                <TableCell>
                    {account.isActive ? <StatusBadge status="success">نشط</StatusBadge> : <StatusBadge status="default">غير نشط</StatusBadge>}
                </TableCell>
                <TableCell>
                    {onEdit && <Button variant="ghost" size="sm" onClick={() => onEdit(account)}>تعديل</Button>}
                    {onDelete && !account.isSystemAccount && <Button variant="ghost" size="sm" onClick={() => onDelete(account)}>حذف</Button>}
                </TableCell>
            </tr>
            {hasChildren && isExpanded && children.map((c) => (
                <AccountTreeRow
                    key={c.id}
                    account={c as Account}
                    depth={depth + 1}
                    expandedIds={expandedIds}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </>
    );
}
```

**Note:** Backend returns flat list ordered by `lft` — you can either:
- Build tree on frontend from `parentId` + `childAccounts`, or
- Use backend order (lft) and indent by depth computed from ancestors

**Simpler approach:** If backend returns flat list sorted by `lft`, compute depth from position and render a single loop with indent.

---

### 4.3 Accounting.tsx — Chart of Accounts tab

**Changes:**
1. Replace flat table with tree view (using `AccountTreeRow` or similar)
2. Use `rootType` colors and `reportType` badge
3. Show `isGroup` vs "دفتر" (ledger)
4. Update/toggle expand state for tree
5. Remove `a.balance` if backend no longer returns it (or keep if Trial Balance is merged per account)

---

## 5. Phase 3 — Postable Accounts Filter

### 5.1 Journal Entry form (إن وُجد)

When user selects an account for a journal line:
- Call `GET /accounting/accounts?postableOnly=true`
- Or use `useAccounts(true)` → show only `isGroup=false` accounts
- This prevents selecting a group account (backend would reject anyway)

### 5.2 Branch profile — Stock account selector

**File:** `src/pages/branches/BranchProfile.tsx`

**Current:** `stockAccounts = allAccounts.filter(a => STOCK_ACCOUNT_CODES.includes(a.code) || a.code.startsWith("113"))`

**Update:** Also filter `!a.isGroup` to ensure only ledger accounts:

```typescript
const stockAccounts = allAccounts.filter(
    (a) => (STOCK_ACCOUNT_CODES.includes(a.code) || a.code.startsWith('113')) && !a.isGroup
);
```

**Note:** `useAccounts()` returns all; for branch stock we only need stock-type ledger accounts. Filtering `!a.isGroup` is sufficient. The `stockAccountId` is sent to backend — backend stores branch → account relation.

---

## 6. Phase 4 — Delete Flow + can-delete

### 6.1 Before delete

When user clicks "حذف" on an account:
1. Call `GET /accounting/accounts/:id/can-delete`
2. If `canDelete === false`:
   - If `hasEntries`: show "لا يمكن حذف الحساب لوجود قيود عليه"
   - If `hasChildren`: show "يجب حذف الحسابات الفرعية أولاً"
3. If `canDelete === true`: show confirm dialog, then call `DELETE /accounting/accounts/:id`

### 6.2 Delete confirm dialog

**Pattern:**

```typescript
const { data: canDelete } = useCanDeleteAccount(accountId);
const deleteMutation = useDeleteAccount();

const handleDeleteClick = (account: Account) => {
    if (!canDelete?.canDelete) {
        if (canDelete?.hasEntries) {
            toast({ variant: 'destructive', title: 'لا يمكن الحذف', description: 'لا يمكن حذف الحساب لوجود قيود عليه' });
        } else if (canDelete?.hasChildren) {
            toast({ variant: 'destructive', title: 'لا يمكن الحذف', description: 'يجب حذف الحسابات الفرعية أولاً' });
        }
        return;
    }
    if (window.confirm(`هل تريد حذف الحساب "${account.name}"؟`)) {
        deleteMutation.mutate(account.id);
    }
};
```

Or use a proper `AlertDialog` for confirmation.

---

## 7. Phase 5 — Journal Entry Errors + Ledger

### 7.1 Error codes (posting)

When creating journal entry, backend may return:
- `POSTING_TO_GROUP_ACCOUNT` — "لا يمكن القيد على حسابات المجموعة"
- `POSTING_TO_DISABLED_ACCOUNT` — "لا يمكن القيد على حسابات معطلة"
- `POSTING_TO_FROZEN_ACCOUNT` — "لا يمكن القيد على حسابات مجمدة"

**Add to `useCreateJournalEntry` `onError`:**

```typescript
onError: (error: any) => {
    const code = error.response?.data?.code;
    const messageAr = error.response?.data?.messageAr;
    const messages: Record<string, string> = {
        POSTING_TO_GROUP_ACCOUNT: 'لا يمكن القيد على حسابات المجموعة',
        POSTING_TO_DISABLED_ACCOUNT: 'لا يمكن القيد على حسابات معطلة',
        POSTING_TO_FROZEN_ACCOUNT: 'لا يمكن القيد على حسابات مجمدة',
        UNBALANCED_ENTRY: 'القيد غير متوازن',
    };
    toast({
        variant: 'destructive',
        title: messages[code] || 'خطأ',
        description: messageAr || error.response?.data?.message,
    });
},
```

### 7.2 Journal detail — line display

Backend now returns `JournalEntryLine` with `accountId`. The `journalEntry` include typically joins `account` so `line.account` has `code`, `name`. Verify API response shape:
- `line.accountCode` → may be from `account.code`
- `line.accountName` → may be from `account.name`

If backend returns `account: { id, code, name }`, update frontend to use `line.account?.code` and `line.account?.name` for display. `Accounting.tsx` JournalDetailCard uses `line.accountCode` and `line.accountName` — ensure backend includes these (via Prisma include).

---

## 8. API Routes Summary (Backend)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/accounting/accounts` | All accounts (optional `?postableOnly=true`) |
| GET | `/accounting/accounts/code/:code` | Account by code |
| GET | `/accounting/accounts/:id` | Account by ID (or code for backward compat) |
| GET | `/accounting/accounts/:id/can-delete` | Check if deletable |
| POST | `/accounting/accounts` | Create account |
| PUT | `/accounting/accounts/:id` | Update account |
| DELETE | `/accounting/accounts/:id` | Delete account |
| POST | `/accounting/accounts/rebuild-tree` | Rebuild nested set |

---

## 9. Files to Create/Modify

| File | Action |
|------|--------|
| `src/types/accounting.ts` | Update Account, CreateAccountDto, UpdateAccountDto, add CanDeleteAccountResponse |
| `src/services/accounting.service.ts` | Update getAccounts, getAccountById, updateAccount(id), deleteAccount, canDeleteAccount |
| `src/hooks/use-accounting.ts` | useAccounts(postableOnly), useAccount(id/code), useUpdateAccount({id,data}), useDeleteAccount, useCanDeleteAccount |
| `src/lib/accounting.ts` | NEW — ROOT_TYPE_COLORS, REPORT_TYPE_LABELS |
| `src/components/accounting/AccountTreeRow.tsx` | NEW — recursive tree row |
| `src/pages/Accounting.tsx` | Replace flat table with tree, rootType colors, delete flow |
| `src/pages/branches/BranchProfile.tsx` | Filter `!a.isGroup` for stock accounts |

---

## 10. Dependencies

- No new npm packages required for basic tree (recursive render).
- Optional: `@atlaskit/tree` or `react-arborist` for advanced tree (drag-drop, virtualization) — Phase 2 can start without them.
