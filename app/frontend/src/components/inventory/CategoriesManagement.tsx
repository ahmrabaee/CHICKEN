import { useState } from "react";
import { Plus, Edit, Trash2, Loader2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/hooks/use-inventory";
import type { Category } from "@/types/inventory";
import { Badge } from "@/components/ui/badge";

const emptyForm = {
  name: "",
  isActive: true,
};

type FormData = typeof emptyForm;

export function CategoriesManagement() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const { data: categories = [], isLoading } = useCategories(true);
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const openCreate = () => {
    setEditingCategory(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setForm({
      code: cat.code,
      name: cat.name,
      nameEn: cat.nameEn || "",
      displayOrder: cat.displayOrder ?? 0,
      isActive: cat.isActive ?? true,
    });
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const payload = {
      name: form.name.trim(),
      isActive: form.isActive,
    };

    try {
      if (editingCategory) {
        await updateMutation.mutateAsync({ id: editingCategory.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      handleClose();
    } catch {
      // Toast handled in mutation
    }
  };

  const handleDelete = (cat: Category) => setDeleteTarget(cat);
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
    } catch {
      // Toast handled in mutation
    } finally {
      setDeleteTarget(null);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card dir="rtl">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5" />
            إدارة الفئات
          </h3>
          <Button size="sm" className="gap-2" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            إضافة فئة
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>لا توجد فئات. أضف فئة جديدة لتصنيف الأصناف.</p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              إضافة فئة
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">الكود</TableHead>
                <TableHead className="text-center">ترتيب العرض</TableHead>
                <TableHead className="text-center">الحالة</TableHead>
                <TableHead className="text-center w-24">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium text-right">{cat.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground text-right">
                    {cat.code}
                  </TableCell>
                  <TableCell className="text-center">{cat.displayOrder ?? 0}</TableCell>
                  <TableCell className="text-center">
                    {cat.isActive !== false ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                        نشط
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                        غير نشط
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary"
                        onClick={() => openEdit(cat)}
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(cat)}
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(o) => !o && handleClose()}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "تعديل الفئة" : "إضافة فئة جديدة"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">الاسم (مطلوب)</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: دجاج طازج"
                  className="text-right"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">نشط</Label>
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: !!v }))}
                />
              </div>
              <DialogFooter className="flex-row-reverse gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={isPending || !form.name.trim()}>
                  {isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  {editingCategory ? "حفظ التعديلات" : "إضافة"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>حذف الفئة</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف الفئة «{deleteTarget?.name}»؟ لا يمكن التراجع عن هذا الإجراء. إن كانت الفئة مرتبطة بأصناف سيظهر خطأ بدلاً من الحذف.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حذف"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
