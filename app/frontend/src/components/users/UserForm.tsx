
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useCreateUser, useUpdateUser, useRoles } from "@/hooks/use-users";
import { useBranches } from "@/hooks/use-branches";
import { User, CreateUserDto } from "@/types/user";
import { Loader2 } from "lucide-react";

const userSchema = z.object({
    username: z.string().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"),
    password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").optional().or(z.literal("")),
    fullName: z.string().min(1, "الاسم الكامل مطلوب"),
    fullNameEn: z.string().optional(),
    phone: z.string().optional(),
    roleId: z.string().min(1, "يجب تحديد دور المستخدم"),
    defaultBranchId: z.string().optional(),
    preferredLanguage: z.enum(["ar", "en"]).default("ar"),
});

type UserFormValues = z.infer<typeof userSchema>;

interface UserFormProps {
    user?: User;
    onSuccess: () => void;
}

export default function UserForm({ user, onSuccess }: UserFormProps) {
    const createUserMutation = useCreateUser();
    const updateUserMutation = useUpdateUser();
    const { data: roles } = useRoles();
    const { data: branches } = useBranches();

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            username: user?.username || "",
            password: "",
            fullName: user?.fullName || "",
            fullNameEn: user?.fullNameEn || "",
            phone: user?.phone || "",
            roleId: user?.roles?.[0] === 'admin' ? "1" : "2", // 1=admin, 2=accountant
            defaultBranchId: user?.defaultBranchId?.toString() || "",
            preferredLanguage: (user?.preferredLanguage as any) || "ar",
        },
    });

    const onSubmit = (data: UserFormValues) => {
        // Clean payload: remove empty strings for optional fields
        const payload: any = {
            username: data.username,
            fullName: data.fullName,
            fullNameEn: data.fullNameEn || undefined,
            phone: data.phone || undefined,
            roleId: parseInt(data.roleId),
            defaultBranchId: data.defaultBranchId ? parseInt(data.defaultBranchId) : undefined,
            preferredLanguage: data.preferredLanguage,
        };

        // Only include password if it's provided (required for new user, optional for update)
        if (data.password) {
            payload.password = data.password;
        }

        if (user) {
            updateUserMutation.mutate({ id: user.id, data: payload }, {
                onSuccess: () => onSuccess(),
            });
        } else {
            // For new users, if password is empty it will fail validation anyway, 
            // but we ensure it's at least attempted if provided.
            createUserMutation.mutate(payload, {
                onSuccess: () => onSuccess(),
            });
        }
    };

    const isLoading = createUserMutation.isPending || updateUserMutation.isPending;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 text-right">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>الاسم الكامل (بالعربي)</FormLabel>
                                <FormControl>
                                    <Input placeholder="أدخل اسم الموظف" {...field} className="text-right" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>اسم المستخدم</FormLabel>
                                <FormControl>
                                    <Input placeholder="أدخل اسم الدخول" {...field} className="text-right font-mono" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{user ? "كلمة المرور الجديدة (اختياري)" : "كلمة المرور"}</FormLabel>
                                <FormControl>
                                    <Input type="password" placeholder="********" {...field} className="text-right font-mono" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="roleId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>دور المستخدم</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger dir="rtl" className="text-right">
                                            <SelectValue placeholder="اختر الدور" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="1">مدير (Admin)</SelectItem>
                                        <SelectItem value="2">محاسب (Cashier)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="defaultBranchId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>الفرع الافتراضي</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger dir="rtl" className="text-right">
                                            <SelectValue placeholder="اختر الفرع" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent dir="rtl">
                                        {branches?.map(branch => (
                                            <SelectItem key={branch.id} value={branch.id.toString()}>
                                                {branch.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="preferredLanguage"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>اللغة المفضلة</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger dir="rtl" className="text-right">
                                            <SelectValue placeholder="اختر اللغة" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="ar">العربية</SelectItem>
                                        <SelectItem value="en">English</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="flex justify-start gap-3 pt-4">
                    <Button type="submit" className="min-w-[120px]" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                جاري الحفظ...
                            </>
                        ) : (
                            user ? "تحديث البيانات" : "إضافة المستخدم"
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
