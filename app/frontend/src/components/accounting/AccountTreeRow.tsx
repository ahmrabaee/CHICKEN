import { ChevronDown, ChevronLeft, Eye, Folder, FileText, Pencil, Trash2 } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Account } from '@/types/accounting';
import { ROOT_TYPE_COLORS, REPORT_TYPE_LABELS } from '@/lib/accounting';
import { formatCurrency } from '@/lib/formatters';

interface AccountWithChildren extends Account {
    _children?: AccountWithChildren[];
}

interface AccountTreeRowProps {
    account: AccountWithChildren;
    depth?: number;
    expandedIds: Set<number>;
    /** net balance (debit − credit) per account id, aggregated up the tree */
    balanceById?: Map<number, number>;
    onToggle: (id: number) => void;
    onView?: (account: Account) => void;
    onEdit?: (account: Account) => void;
    onDelete?: (account: Account) => void;
}

export function AccountTreeRow({
    account,
    depth = 0,
    expandedIds,
    balanceById,
    onToggle,
    onView,
    onEdit,
    onDelete,
}: AccountTreeRowProps) {
    const children = account._children || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(account.id);
    const style = ROOT_TYPE_COLORS[account.rootType] || { bg: '', text: '', label: '—' };
    const net = balanceById?.get(account.id) ?? 0;

    return (
        <>
            <TableRow className="data-table-row hover:bg-muted/50">
                <TableCell className="align-middle text-center">
                    <div className="flex items-center justify-center gap-1" style={{ paddingRight: depth * 20 }}>
                        {hasChildren ? (
                            <button
                                type="button"
                                onClick={() => onToggle(account.id)}
                                className="p-0.5 hover:bg-muted rounded"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                ) : (
                                    <ChevronLeft className="w-4 h-4 -rotate-90" />
                                )}
                            </button>
                        ) : (
                            <span className="w-5 inline-block" />
                        )}
                        {account.isGroup ? (
                            <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        {onView ? (
                            <button type="button" onClick={() => onView(account)} className="font-mono text-sm hover:underline min-w-0">
                                {account.code}
                            </button>
                        ) : (
                            <span className="font-mono text-sm">{account.code}</span>
                        )}
                    </div>
                </TableCell>
                <TableCell className="font-medium text-center">
                    {onView ? (
                        <button type="button" onClick={() => onView(account)} className="hover:underline w-full">
                            {account.name}
                        </button>
                    ) : (
                        <span>{account.name}</span>
                    )}
                </TableCell>
                <TableCell className="text-center">
                    <div className="flex justify-center">
                        <Badge variant="outline" className={`text-xs ${style.bg} ${style.text}`}>
                            {style.label}
                        </Badge>
                    </div>
                </TableCell>
                <TableCell className="text-center">
                    <span className="text-xs text-muted-foreground">
                        {REPORT_TYPE_LABELS[account.reportType] || account.reportType}
                    </span>
                </TableCell>
                <TableCell className="text-center">
                    <div className="flex justify-center">
                        {account.isGroup ? (
                            <Badge variant="secondary">مجموعة</Badge>
                        ) : (
                            <Badge variant="outline">دفتر</Badge>
                        )}
                    </div>
                </TableCell>
                <TableCell className="text-center whitespace-nowrap">
                    {net === 0 ? (
                        <span className="text-muted-foreground text-xs">—</span>
                    ) : net > 0 ? (
                        <span className="font-mono text-sm font-semibold text-blue-700 dark:text-blue-400">
                            {formatCurrency(net)}
                            <span className="text-[10px] font-normal text-muted-foreground mr-1">مدين</span>
                        </span>
                    ) : (
                        <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(-net)}
                            <span className="text-[10px] font-normal text-muted-foreground mr-1">دائن</span>
                        </span>
                    )}
                </TableCell>
                <TableCell className="text-center">
                    <div className="flex justify-center">
                        {account.isActive ? (
                            <StatusBadge status="success">نشط</StatusBadge>
                        ) : (
                            <StatusBadge status="default">غير نشط</StatusBadge>
                        )}
                    </div>
                </TableCell>
                <TableCell className="text-center">
                    <div className="flex gap-1 justify-center">
                        {onView && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="عرض" onClick={() => onView(account)}>
                                <Eye className="w-4 h-4" />
                            </Button>
                        )}
                        {onEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="تعديل" onClick={() => onEdit(account)}>
                                <Pencil className="w-4 h-4" />
                            </Button>
                        )}
                        {onDelete && !account.isSystemAccount && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="حذف" onClick={() => onDelete(account)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </TableCell>
            </TableRow>
            {hasChildren &&
                isExpanded &&
                children.map((c) => (
                    <AccountTreeRow
                        key={c.id}
                        account={c}
                        depth={depth + 1}
                        expandedIds={expandedIds}
                        balanceById={balanceById}
                        onToggle={onToggle}
                        onView={onView}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))}
        </>
    );
}
