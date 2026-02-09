import { useState } from "react";
import {
    Mail,
    Phone,
    MapPin,
    Search,
    Plus,
    Download,
    MoreHorizontal,
    Edit,
    UserX,
    UserCheck,
    Filter,
    KeyRound,
    Users as UsersIcon,
    ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/ui/status-badge";
import { useUsers, useDeleteUser, useUpdateUser, useActiveSessions } from "@/hooks/use-users";
import { useBranches } from "@/hooks/use-branches";
import { User, UserListQuery } from "@/types/user";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import UserForm from "@/components/users/UserForm";
import ResetPasswordDialog from "@/components/users/ResetPasswordDialog";
import { userService } from "@/services/user.service";
import { toast } from "@/hooks/use-toast";

export default function Users() {
    const [queryParams, setQueryParams] = useState<UserListQuery>({
        page: 1,
        pageSize: 10,
        search: "",
    });
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [resettingPasswordUser, setResettingPasswordUser] = useState<User | null>(null);

    const { data: response, isLoading } = useUsers(queryParams);
    const { data: activeSessions } = useActiveSessions();
    const { data: branches } = useBranches();
    const deleteUserMutation = useDeleteUser();
    const updateUserMutation = useUpdateUser();

    const users = response?.data || [];
    const pagination = response?.pagination;

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQueryParams(prev => ({ ...prev, search: e.target.value, page: 1 }));
    };

    const handleToggleStatus = (user: User) => {
        updateUserMutation.mutate({
            id: user.id,
            data: { isActive: !user.isActive }
        });
    };

    const rolesMap: Record<string, { label: string; color: string }> = {
        'admin': { label: 'مدير', color: 'danger' },
        'cashier': { label: 'محاسب', color: 'primary' },
    };

    return (
        <div dir="rtl" className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
                    <p className="text-muted-foreground mt-1">عرض وإدارة حسابات الموظفين وصلاحياتهم</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="gap-2">
                        <Download className="w-4 h-4" />
                        تصدير
                    </Button>
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="w-4 h-4" />
                                مستخدم جديد
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]" dir="rtl">
                            <DialogHeader>
                                <DialogTitle className="text-right">إضافة مستخدم جديد</DialogTitle>
                            </DialogHeader>
                            <UserForm onSuccess={() => setIsAddOpen(false)} />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                        <DialogContent className="sm:max-w-[600px]" dir="rtl">
                            <DialogHeader>
                                <DialogTitle className="text-right">تعديل بيانات المستخدم</DialogTitle>
                            </DialogHeader>
                            {editingUser && (
                                <UserForm
                                    user={editingUser}
                                    onSuccess={() => setEditingUser(null)}
                                />
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-primary/5 to-transparent">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <UsersIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">إجمالي المستخدمين</p>
                                <p className="text-2xl font-bold">{pagination?.totalItems || 0}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/10">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">الجلسات النشطة</p>
                                <p className="text-2xl font-bold text-emerald-600">{activeSessions?.activeCount || 0}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/5 to-transparent border-orange-500/10">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                                <UserX className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">الحسابات المعطلة</p>
                                <p className="text-2xl font-bold text-orange-600">
                                    {users.filter(u => !u.isActive).length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="بحث باسم المستخدم أو الاسم الكامل..."
                                value={queryParams.search}
                                onChange={handleSearch}
                                className="pr-10 text-right"
                            />
                        </div>
                        <Button variant="outline" className="gap-2">
                            <Filter className="w-4 h-4" />
                            تصفية
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead className="text-right">المستخدم</TableHead>
                                <TableHead className="text-right">التواصل</TableHead>
                                <TableHead className="text-right">الدور</TableHead>
                                <TableHead className="text-right">الفرع</TableHead>
                                <TableHead className="text-center">الحالة</TableHead>
                                <TableHead className="text-right">آخر ظهور</TableHead>
                                <TableHead className="text-right">تاريخ البدء</TableHead>
                                <TableHead className="text-center w-12">إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                        جاري التحميل...
                                    </TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                        لا يوجد مستخدمين مطابقين للبحث
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-slate-900">{user.fullName}</span>
                                                {user.fullNameEn && (
                                                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{user.fullNameEn}</span>
                                                )}
                                                <span className="text-xs text-primary font-mono mt-0.5">@{user.username}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <TooltipProvider>
                                                    {user.email && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors">
                                                                    <Mail className="w-3.5 h-3.5" />
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">
                                                                {user.email}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                    {user.phone && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-colors">
                                                                    <Phone className="w-3.5 h-3.5" />
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">
                                                                {user.phone}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </TooltipProvider>
                                                {!user.email && !user.phone && (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                {user.roles.map(role => (
                                                    <StatusBadge
                                                        key={role}
                                                        status={(rolesMap[role]?.color as any) || 'default'}
                                                    >
                                                        {rolesMap[role]?.label || role}
                                                    </StatusBadge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                                {branches?.find(b => b.id === user.defaultBranchId)?.name || "غير محدد"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <StatusBadge status={user.isActive ? "success" : "default"}>
                                                {user.isActive ? "نشط" : "معطل"}
                                            </StatusBadge>
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-slate-600">
                                            {user.lastLoginAt
                                                ? format(new Date(user.lastLoginAt), "PP p", { locale: ar })
                                                : "لم يدخل بعد"}
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-slate-600">
                                            {format(new Date(user.createdAt), "PP", { locale: ar })}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        className="gap-2 cursor-pointer"
                                                        onClick={() => setEditingUser(user)}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                        تعديل البيانات
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="gap-2 cursor-pointer"
                                                        onClick={() => handleToggleStatus(user)}
                                                    >
                                                        {user.isActive ? (
                                                            <>
                                                                <UserX className="w-4 h-4 text-orange-500" />
                                                                تعطيل الحساب
                                                            </>
                                                        ) : (
                                                            <>
                                                                <UserCheck className="w-4 h-4 text-green-500" />
                                                                تفعيل الحساب
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="gap-2 cursor-pointer text-orange-600 focus:text-orange-600"
                                                        onClick={() => setResettingPasswordUser(user)}
                                                    >
                                                        <KeyRound className="w-4 h-4" />
                                                        إعادة تعيين كلمة المرور
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Pagination Placeholder */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                        عرض {users.length} من {pagination.totalItems} مستخدم
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!pagination.hasPrev}
                            onClick={() => setQueryParams(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                        >
                            السابق
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!pagination.hasNext}
                            onClick={() => setQueryParams(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                        >
                            التالي
                        </Button>
                    </div>
                </div>
            )}

            <ResetPasswordDialog
                user={resettingPasswordUser}
                onClose={() => setResettingPasswordUser(null)}
            />
        </div>
    );
}
