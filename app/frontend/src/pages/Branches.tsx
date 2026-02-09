import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Building2,
    Plus,
    Search,
    Edit,
    Trash2,
    RefreshCw,
    Scale,
    MapPin,
    Phone,
    Users,
    Star,
    X,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
    useBranches,
    useDeleteBranch,
    useActivateBranch,
} from "@/hooks/use-branches";
import { Branch } from "@/types/branch";

export default function Branches() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

    // Queries and mutations
    const { data: branches = [], isLoading, error } = useBranches();
    const deleteMutation = useDeleteBranch();
    const activateMutation = useActivateBranch();

    // Filter branches
    const filteredBranches = branches.filter((branch) => {
        const matchesSearch =
            branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            branch.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            branch.nameEn?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = showInactive ? true : branch.isActive;

        return matchesSearch && matchesStatus;
    });

    // Navigate to create page
    const handleCreate = () => {
        navigate("/branches/new");
    };

    // Navigate to edit page
    const handleEdit = (branch: Branch) => {
        navigate(`/branches/${branch.id}`);
    };

    // Open delete confirmation
    const handleDeleteClick = (branch: Branch) => {
        setSelectedBranch(branch);
        setIsDeleteDialogOpen(true);
    };

    // Confirm delete
    const handleConfirmDelete = async () => {
        if (!selectedBranch) return;

        try {
            await deleteMutation.mutateAsync(selectedBranch.id);
            toast.success("تم إلغاء تفعيل الفرع بنجاح");
            setIsDeleteDialogOpen(false);
        } catch (error: any) {
            const errorMsg =
                error.response?.data?.messageAr ||
                error.response?.data?.message ||
                "لا يمكن إلغاء تفعيل هذا الفرع";
            toast.error(errorMsg);
        }
    };

    // Activate branch
    const handleActivate = async (branch: Branch) => {
        try {
            await activateMutation.mutateAsync(branch.id);
            toast.success("تم تفعيل الفرع بنجاح");
        } catch (error: any) {
            const errorMsg =
                error.response?.data?.messageAr ||
                error.response?.data?.message ||
                "حدث خطأ أثناء تفعيل الفرع";
            toast.error(errorMsg);
        }
    };

    if (error) {
        return (
            <div className="flex items-center justify-center h-96" dir="rtl">
                <Card className="w-96">
                    <CardContent className="pt-6 text-center">
                        <p className="text-destructive">حدث خطأ في تحميل البيانات</p>
                        <Button
                            onClick={() => window.location.reload()}
                            className="mt-4"
                            variant="outline"
                        >
                            إعادة المحاولة
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6" dir="rtl">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">إدارة الفروع</h1>
                    <p className="text-muted-foreground mt-1">
                        إنشاء وإدارة فروع المتجر
                    </p>
                </div>
                <Button onClick={handleCreate} className="gap-2">
                    <Plus className="w-4 h-4" />
                    إضافة فرع جديد
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="بحث عن فرع..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-10"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                id="showInactive"
                                checked={showInactive}
                                onCheckedChange={setShowInactive}
                            />
                            <Label htmlFor="showInactive">عرض الفروع غير النشطة</Label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Branches Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        الفروع ({filteredBranches.length})
                    </CardTitle>
                    <CardDescription>جميع فروع المتجر وحالتها</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredBranches.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>لا توجد فروع مطابقة للبحث</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right">رمز الفرع</TableHead>
                                    <TableHead className="text-right">اسم الفرع</TableHead>
                                    <TableHead className="text-right">العنوان</TableHead>
                                    <TableHead className="text-right">الهاتف</TableHead>
                                    <TableHead className="text-right">الميزان</TableHead>
                                    <TableHead className="text-right">المستخدمين</TableHead>
                                    <TableHead className="text-right">الحالة</TableHead>
                                    <TableHead className="text-right">الإجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredBranches.map((branch) => (
                                    <TableRow
                                        key={branch.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleEdit(branch)}
                                    >
                                        <TableCell className="font-mono">
                                            <div className="flex items-center gap-2">
                                                {branch.isMainBranch && (
                                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                )}
                                                {branch.code}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{branch.name}</p>
                                                {branch.nameEn && (
                                                    <p className="text-sm text-muted-foreground">
                                                        {branch.nameEn}
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {branch.address ? (
                                                <div className="flex items-center gap-1 text-sm">
                                                    <MapPin className="w-3 h-3" />
                                                    {branch.address}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {branch.phone ? (
                                                <div className="flex items-center gap-1 text-sm" dir="ltr">
                                                    <Phone className="w-3 h-3" />
                                                    {branch.phone}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {branch.hasScale ? (
                                                <div className="flex items-center gap-1">
                                                    <Scale className={`w-4 h-4 ${branch.scaleComPort ? "text-green-500" : "text-yellow-500"}`} />
                                                    <span className="text-sm font-mono" dir="ltr">
                                                        {branch.scaleComPort || <span className="text-yellow-600 text-xs">غير محدد</span>}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">لا يوجد</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Users className="w-4 h-4 text-muted-foreground" />
                                                <span>{branch.userCount || 0}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={branch.isActive ? "default" : "secondary"}
                                            >
                                                {branch.isActive ? "نشط" : "غير نشط"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(branch)}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                {!branch.isActive ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleActivate(branch)}
                                                        disabled={activateMutation.isPending}
                                                    >
                                                        <RefreshCw className="w-4 h-4 text-green-500" />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDeleteClick(branch)}
                                                        disabled={branch.isMainBranch}
                                                    >
                                                        <Trash2
                                                            className={`w-4 h-4 ${branch.isMainBranch
                                                                ? "text-muted-foreground"
                                                                : "text-destructive"
                                                                }`}
                                                        />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>إلغاء تفعيل الفرع</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من إلغاء تفعيل الفرع "{selectedBranch?.name}"؟
                            <br />
                            يمكنك إعادة تفعيله لاحقاً.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row-reverse gap-2">
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "إلغاء التفعيل"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
