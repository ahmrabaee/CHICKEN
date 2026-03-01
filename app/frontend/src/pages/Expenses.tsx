import { useState } from "react";
import { Search, Plus, Eye, Trash2, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { useNavigate } from "react-router-dom";
import { useExpenses, useExpense, useDeleteExpense, useApproveExpense } from "@/hooks/use-expenses";
import { Expense } from "@/types/expenses";
import { toast } from "@/hooks/use-toast";

function formatCurrency(v: number) { return `₪ ${(v / 100).toFixed(2)}`; }
function formatDate(d: string) { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }

const categoryLabels: Record<string, string> = {
    utilities: "خدمات", rent: "إيجار", salaries: "رواتب", maintenance: "صيانة",
    supplies: "مستلزمات", transport: "نقل", marketing: "تسويق", other: "أخرى",
};
const methodLabels: Record<string, string> = {
    cash: "نقدي", card: "بطاقة", bank_transfer: "تحويل بنكي",
};



export default function Expenses() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [page, setPage] = useState(1);

    const queryParams = {
        page, pageSize: 20,
        ...(typeFilter !== "all" ? { type: typeFilter as any } : {}),
    };

    const { data, isLoading, error } = useExpenses(queryParams);
    const expenses = data?.data || [];
    const pagination = data?.pagination;
    const deleteExpense = useDeleteExpense();
    const approveExpense = useApproveExpense();

    const filtered = expenses.filter((e: Expense) => {
        if (!searchQuery) return true;
        const s = searchQuery.toLowerCase();
        return (
            e.description.toLowerCase().includes(s) ||
            e.expenseNumber.toLowerCase().includes(s) ||
            (e.category?.name || "").toLowerCase().includes(s)
        );
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">المصروفات</h1>
                    <p className="text-muted-foreground mt-1">إدارة جميع المصروفات</p>
                </div>
                <Button className="gap-2" onClick={() => navigate("/expenses/new")}>
                    <Plus className="w-4 h-4" /> مصروف جديد
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
                        </div>
                        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                            <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="النوع" /></SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="business">عمل</SelectItem>
                                <SelectItem value="personal">شخصي</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /><span className="mr-3 text-muted-foreground">جاري التحميل...</span></div>
                    ) : error ? (
                        <div className="text-center py-16 text-red-500"><p>حدث خطأ في تحميل البيانات</p></div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground"><p className="text-lg">لا توجد مصروفات</p></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="data-table-header">
                                    <TableHead className="text-right">رقم المصروف</TableHead>
                                    <TableHead className="text-right">الوصف</TableHead>
                                    <TableHead className="text-center">الفئة</TableHead>
                                    <TableHead className="text-center">التاريخ</TableHead>
                                    <TableHead className="text-center">المبلغ</TableHead>
                                    <TableHead className="text-center">الحالة</TableHead>
                                    <TableHead className="text-center w-28 text-white">إجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((e: Expense) => (
                                    <TableRow key={e.id} className="data-table-row">
                                        <TableCell className="font-mono text-xs">{e.expenseNumber}</TableCell>
                                        <TableCell className="font-medium max-w-[200px] truncate">{e.description}</TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{e.category?.name || "—"}</span>
                                        </TableCell>
                                        <TableCell className="text-center text-muted-foreground">{formatDate(e.expenseDate)}</TableCell>
                                        <TableCell className="text-center font-semibold">{formatCurrency(e.amount)}</TableCell>
                                        <TableCell className="text-center">
                                            {e.isApproved
                                                ? <StatusBadge status="success">معتمد</StatusBadge>
                                                : <StatusBadge status="warning">معلق</StatusBadge>}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="عرض" onClick={() => navigate(`/expenses/${e.id}`)}>
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                {!e.isApproved && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" title="اعتماد"
                                                        onClick={() => approveExpense.mutate(e.id)}>
                                                        <CheckCircle className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="حذف"
                                                    onClick={() => { if (confirm("هل أنت متأكد من حذف هذا المصروف؟")) deleteExpense.mutate(e.id); }}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{pagination ? `صفحة ${pagination.page} من ${pagination.totalPages}` : `${filtered.length} مصروف`}</p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={!pagination?.hasPrev} onClick={() => setPage(p => Math.max(1, p - 1))}>السابق</Button>
                    <Button variant="outline" size="sm" disabled={!pagination?.hasNext} onClick={() => setPage(p => p + 1)}>التالي</Button>
                </div>
            </div>
        </div>
    );
}
