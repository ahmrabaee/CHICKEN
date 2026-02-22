import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import type { CompleteSetupDto } from '@/types/auth';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, User, ShieldCheck, ArrowRight, ArrowLeft, Loader2, RefreshCcw, ServerCrash, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const setupSchema = z.object({
    businessName: z.string().min(2, 'اسم النشاط التجاري مطلوب'),
    businessNameEn: z.string().optional(),
    preferredLanguage: z.enum(['ar', 'en']).default('ar'),
    adminFullName: z.string().min(3, 'الاسم الكامل مطلوب'),
    adminFullNameEn: z.string().optional(),
    adminUsername: z.string().min(3, 'اسم المستخدم مطلوب'),
    adminPassword: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
});

type SetupFormValues = z.infer<typeof setupSchema>;

const Setup = () => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [isRetryingSetupCheck, setIsRetryingSetupCheck] = useState(false);
    const { setupStatus, setupCompleted, setupErrorMessage, refreshSetupStatus } = useAuth();
    const navigate = useNavigate();

    const form = useForm<SetupFormValues>({
        resolver: zodResolver(setupSchema),
        defaultValues: {
            businessName: '',
            businessNameEn: '',
            preferredLanguage: 'ar',
            adminFullName: '',
            adminFullNameEn: '',
            adminUsername: 'admin',
            adminPassword: '',
        },
    });

    const onSubmit = async (data: SetupFormValues) => {
        setLoading(true);
        try {
            const payload: CompleteSetupDto = {
                businessName: data.businessName,
                businessNameEn: data.businessNameEn?.trim() || undefined,
                preferredLanguage: data.preferredLanguage,
                adminFullName: data.adminFullName,
                adminFullNameEn: data.adminFullNameEn?.trim() || undefined,
                adminUsername: data.adminUsername,
                adminPassword: data.adminPassword,
            };
            await authService.completeSetup(payload);
            toast.success('تم إعداد النظام بنجاح');
            await refreshSetupStatus();
            navigate('/', { replace: true });
        } catch (error: any) {
            const res = error.response?.data;
            const err = res?.error;
            const msgAr = err?.messageAr ?? err?.message ?? res?.messageAr ?? res?.message;
            const msg = Array.isArray(msgAr) ? msgAr.join(' · ') : String(msgAr || '');
            const details = err?.details;
            const fullMsg = details?.length ? [...(Array.isArray(details) ? details : [details])].join(' · ') : msg;
            console.error('Setup failed:', { res, err, msg: fullMsg || msg });
            toast.error(fullMsg || msg || 'فشل إعداد النظام');
        } finally {
            setLoading(false);
        }
    };

    const nextStep = async () => {
        const fields = step === 1
            ? ['businessName', 'businessNameEn', 'preferredLanguage']
            : ['adminFullName', 'adminFullNameEn', 'adminUsername', 'adminPassword'];

        const isValid = await form.trigger(fields as any);
        if (isValid) setStep(step + 1);
    };

    const prevStep = () => setStep(step - 1);

    const retrySetupCheck = async () => {
        setIsRetryingSetupCheck(true);
        try {
            await refreshSetupStatus();
        } finally {
            setIsRetryingSetupCheck(false);
        }
    };

    useEffect(() => {
        if (setupCompleted) {
            navigate('/', { replace: true });
        }
    }, [setupCompleted, navigate]);

    if (setupStatus === 'checking') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse">جاري التحقق من حالة الإعداد...</p>
                </div>
            </div>
        );
    }

    if (setupStatus === 'backend_unreachable' || setupStatus === 'backend_error') {
        return (
            <div className="flex items-center justify-center min-h-screen p-4" dir="rtl">
                <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                        {setupStatus === 'backend_unreachable' ? (
                            <WifiOff className="h-6 w-6 text-amber-500" />
                        ) : (
                            <ServerCrash className="h-6 w-6 text-destructive" />
                        )}
                        <h2 className="text-lg font-semibold">
                            {setupStatus === 'backend_unreachable' ? 'تعذر الاتصال بالخادم' : 'الخادم غير جاهز حالياً'}
                        </h2>
                    </div>
                    <p className="mb-5 text-sm text-muted-foreground">
                        {setupErrorMessage || 'لا يمكن المتابعة حالياً. شغل الخادم ثم أعد المحاولة.'}
                    </p>
                    <Button
                        type="button"
                        onClick={retrySetupCheck}
                        disabled={isRetryingSetupCheck}
                        className="w-full gap-2"
                    >
                        {isRetryingSetupCheck ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                جاري إعادة المحاولة...
                            </>
                        ) : (
                            <>
                                <RefreshCcw className="h-4 w-4" />
                                إعادة المحاولة
                            </>
                        )}
                    </Button>
                </div>
            </div>
        );
    }

    if (setupStatus === 'setup_complete') {
        return null;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 font-tajawal" dir="rtl">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl"
            >
                <Card className="shadow-xl border-t-4 border-t-primary overflow-hidden">
                    <CardHeader className="text-center pb-2">
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                                {step === 1 ? <Building2 size={32} /> : <User size={32} />}
                            </div>
                        </div>
                        <CardTitle className="text-2xl font-bold">معالج إعداد النظام</CardTitle>
                        <CardDescription>أهلاً بك! لنقم بضبط إعدادات متجرك الآن</CardDescription>
                    </CardHeader>

                    <div className="px-8 pt-4">
                        <div className="flex flex-row-reverse items-center justify-between mb-8 relative">
                            <div className="absolute top-1/2 right-0 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -z-10" />
                            {[1, 2, 3].map((s) => (
                                <div
                                    key={s}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${step >= s ? 'bg-primary text-white scale-110 shadow-lg' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                        }`}
                                >
                                    {s === 3 ? <ShieldCheck size={18} /> : s}
                                </div>
                            ))}
                        </div>
                    </div>

                    <CardContent className="pt-6">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <AnimatePresence mode="wait">
                                    {step === 1 && (
                                        <motion.div
                                            key="step1"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="space-y-4"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="businessName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>اسم المنشأة (عربي)</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="مثال: مطعم الدجاج الذهبي" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="businessNameEn"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>اسم المنشأة بالإنجليزي (اختياري)</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="مثال: Golden Chicken POS" {...field} className="text-left" dir="ltr" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="preferredLanguage"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>اللغة الافتراضية للنظام</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger dir="rtl" className="text-right">
                                                                    <SelectValue placeholder="اختر اللغة" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent dir="rtl">
                                                                <SelectItem value="ar">العربية (رئيسي)</SelectItem>
                                                                <SelectItem value="en">الإنجليزية (قريباً)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </motion.div>
                                    )}

                                    {step === 2 && (
                                        <motion.div
                                            key="step2"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="space-y-4"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="adminFullName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>اسم المدير الكامل</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="الاسم ثلاثي" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="adminUsername"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>اسم المستخدم (للدخول)</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="مثال: admin أو مدير" {...field} dir="ltr" className="text-left" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="adminPassword"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>كلمة مرور المدير</FormLabel>
                                                        <FormControl>
                                                            <Input type="password" placeholder="********" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </motion.div>
                                    )}

                                    {step === 3 && (
                                        <motion.div
                                            key="step3"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="text-center py-6 space-y-4"
                                        >
                                            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white dark:border-slate-800 shadow-lg">
                                                <ShieldCheck size={40} />
                                            </div>
                                            <h3 className="text-xl font-bold">كل شيء جاهز!</h3>
                                            <p className="text-slate-500 max-w-sm mx-auto">
                                                بمجرد الضغط على إنهاء، سيتم إنشاء حساب المدير وتهيئة قاعدة البيانات للعمل.
                                            </p>
                                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl text-right text-sm space-y-1 inline-block min-w-48">
                                                <p><span className="text-slate-500">المنشأة:</span> {form.getValues('businessName')}</p>
                                                <p><span className="text-slate-500">المدير:</span> {form.getValues('adminFullName')}</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </form>
                        </Form>
                    </CardContent>

                    <CardFooter className="flex flex-row-reverse justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30 border-t p-6 mt-6">
                        {step > 1 ? (
                            <Button variant="outline" onClick={prevStep} disabled={loading} className="gap-2">
                                <ArrowLeft size={16} /> السابق
                            </Button>
                        ) : (
                            <div />
                        )}

                        {step < 3 ? (
                            <Button onClick={nextStep} className="gap-2">
                                <ArrowRight size={16} /> التالي
                            </Button>
                        ) : (
                            <Button
                                onClick={form.handleSubmit(onSubmit)}
                                disabled={loading}
                                className="bg-green-600 hover:bg-green-700 text-white gap-2 min-w-32 shadow-lg shadow-green-600/20"
                            >
                                {loading ? <Loader2 className="animate-spin" size={18} /> : 'إنهاء الإعداد'}
                            </Button>
                        )}
                    </CardFooter>
                </Card>
                <p className="text-center text-slate-400 text-xs mt-6">
                    نظام إدارة مبيعات الدجاج والمخاسب المتكامل v1.0.0
                </p>
            </motion.div>
        </div>
    );
};

export default Setup;
