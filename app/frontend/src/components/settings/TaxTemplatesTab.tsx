import { useState } from "react";
import { Trash2, Loader2, Receipt } from "lucide-react";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useTaxTemplates, useDeleteTaxTemplate } from "@/hooks/use-tax";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatRate(rate: number): string {
    return `${rate / 100}%`;
}

export function TaxTemplatesTab() {
    const [typeFilter, setTypeFilter] = useState<"all" | "sales" | "purchases">("all");
    const { data: templates, isLoading } = useTaxTemplates(
        typeFilter === "all" ? undefined : typeFilter
    );
    const deleteMutation = useDeleteTaxTemplate();
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const list = templates ?? [];

    const handleDelete = (id: number) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteMutation.mutateAsync(deleteId);
            setDeleteId(null);
        } catch {
            // toast in mutation
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    قوالب الضرائب
                </CardTitle>
                <CardDescription>
                    Blueprint 05 — إدارة قوالب ضريبة القيمة المضافة للمبيعات والمشتريات
                </CardDescription>
                <div className="flex gap-2 pt-2">
                    <Select
                        value={typeFilter}
                        onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            <SelectItem value="sales">مبيعات</SelectItem>
                            <SelectItem value="purchases">مشتريات</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : list.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>لا توجد قوالب ضرائب. يتم إنشاء القوالب الافتراضية عند تشغيل الـ seed.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>الاسم</TableHead>
                                <TableHead>النوع</TableHead>
                                <TableHead>عدد البنود</TableHead>
                                <TableHead>النسب</TableHead>
                                <TableHead className="w-20">إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {list.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell className="font-medium">{t.name}</TableCell>
                                    <TableCell>
                                        {t.type === "sales" ? "مبيعات" : "مشتريات"}
                                    </TableCell>
                                    <TableCell>{t.items?.length ?? 0}</TableCell>
                                    <TableCell>
                                        {t.items?.map((i) => formatRate(i.rate)).join("، ") || "—"}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive"
                                            onClick={() => handleDelete(t.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}

                <p className="text-xs text-muted-foreground mt-4">
                    إنشاء وتعديل القوالب يتطلب صلاحيات المدير. استخدم واجهة API أو أضف حوار إضافة/تعديل لاحقاً.
                </p>
            </CardContent>

            <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>حذف قالب الضريبة</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من حذف هذا القالب؟ لا يمكن حذف القوالب المستخدمة في فواتير.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground"
                        >
                            حذف
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
