
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { useResetPassword } from "@/hooks/use-users";
import { Loader2, KeyRound } from "lucide-react";
import { User } from "@/types/user";

const resetPasswordSchema = z.object({
    password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
    confirmPassword: z.string().min(8, "تأكيد كلمة المرور مطلوب"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "كلمات المرور غير متطابقة",
    path: ["confirmPassword"],
});

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordDialogProps {
    user: User | null;
    onClose: () => void;
}

export default function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
    const resetMutation = useResetPassword();

    const form = useForm<ResetPasswordValues>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            password: "",
            confirmPassword: "",
        },
    });

    const onSubmit = (data: ResetPasswordValues) => {
        if (!user) return;

        resetMutation.mutate({
            userId: user.id,
            newPassword: data.password
        }, {
            onSuccess: () => {
                onClose();
                form.reset();
            }
        });
    };

    return (
        <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-primary" />
                        إعادة تعيين كلمة المرور
                    </DialogTitle>
                    <DialogDescription className="text-right mt-2 text-slate-500">
                        سيتم تغيير كلمة المرور للمستخدم <span className="font-bold text-slate-900">@{user?.username}</span> وسوف يتم تسجيل خروجه من جميع الأجهزة.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>كلمة المرور الجديدة</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="********" {...field} className="text-right font-mono" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="confirmPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>تأكيد كلمة المرور الجديدة</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="********" {...field} className="text-right font-mono" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-start gap-3 pt-4">
                            <Button type="submit" className="w-full" disabled={resetMutation.isPending}>
                                {resetMutation.isPending ? (
                                    <>
                                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                        جاري المعالجة...
                                    </>
                                ) : (
                                    "تحديث كلمة المرور"
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
