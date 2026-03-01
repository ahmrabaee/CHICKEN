import { useState } from "react";
import { Save, Upload, User, Bell, Printer, Globe, Key, Check, X, Calculator, Receipt, Database, Shield, Barcode, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { useChangePassword } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { clearTokens, getStoredUser } from "@/lib/auth";
import { toast } from "sonner";
import { authService } from "@/services/auth.service";
import { AccountingSettingsTab } from "@/components/settings/AccountingSettingsTab";
import { TaxTemplatesTab } from "@/components/settings/TaxTemplatesTab";
import { BackupSettingsTab } from "@/features/backup/components/BackupSettingsTab";
import { PageAccessSettingsTab } from "@/components/settings/PageAccessSettingsTab";
import { BarcodeSettingsTab } from "@/components/settings/BarcodeSettingsTab";
import { BankAccountsSettingsTab } from "@/components/settings/BankAccountsSettingsTab";

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
  newPassword: z.string().min(8, "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل"),
  confirmPassword: z.string().min(1, "تأكيد كلمة المرور مطلوب"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "كلمتا المرور غير متطابقتين",
  path: ["confirmPassword"],
});


type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export default function Settings() {
  const navigate = useNavigate();
  const changePasswordMutation = useChangePassword();
  const [oldPasswordValid, setOldPasswordValid] = useState<boolean | null>(null);
  const [isCheckingPassword, setIsCheckingPassword] = useState(false);

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Check old password validity - ONLY when user finishes typing (onBlur)
  const checkOldPassword = async (password: string) => {
    if (!password || password.length < 3) {
      setOldPasswordValid(null);
      return;
    }

    setIsCheckingPassword(true);
    try {
      const username = getStoredUser()?.username;
      if (!username) {
        setOldPasswordValid(null);
        return;
      }

      // Try login just once when user leaves the field
      await authService.login({ username, password });
      setOldPasswordValid(true);
    } catch (error) {
      setOldPasswordValid(false);
    } finally {
      setIsCheckingPassword(false);
    }
  };

  const onChangePassword = async (data: ChangePasswordFormValues) => {
    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: data.oldPassword,
        newPassword: data.newPassword,
      });

      // Clear tokens and redirect to login (backend clears all sessions)
      clearTokens();
      toast.success("تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى");
      navigate("/login");
    } catch (error: any) {
      console.error("Password change failed:", error);
      // Try to get Arabic error message from backend
      const errorMessage = error.response?.data?.messageAr ||
        error.response?.data?.message ||
        "فشل تغيير كلمة المرور. تحقق من كلمة المرور الحالية";
      toast.error(errorMessage);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-muted-foreground mt-1">إدارة إعدادات النظام والمحل</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="shop" className="space-y-6" dir="rtl">
        {/* Tab bar: tabs + any action button share the same flex row */}
        <div className="flex items-center gap-3 flex-nowrap w-full min-w-0">
          <TabsList className="flex h-auto flex-nowrap overflow-x-auto flex-1 min-w-0 gap-1 p-1">
            <TabsTrigger value="shop" className="shrink-0 gap-2">
              <Globe className="w-4 h-4" />
              المحل
            </TabsTrigger>
            <TabsTrigger value="account" className="shrink-0 gap-2">
              <Key className="w-4 h-4" />
              الحساب
            </TabsTrigger>
            <TabsTrigger value="accounting" className="shrink-0 gap-2">
              <Calculator className="w-4 h-4" />
              المحاسبة
            </TabsTrigger>
            <TabsTrigger value="bank-accounts" className="shrink-0 gap-2">
              <Building2 className="w-4 h-4" />
              الحسابات البنكية
            </TabsTrigger>
            <TabsTrigger value="tax-templates" className="shrink-0 gap-2">
              <Receipt className="w-4 h-4" />
              قوالب الضرائب
            </TabsTrigger>
            <TabsTrigger value="page-access" className="shrink-0 gap-2">
              <Shield className="w-4 h-4" />
              صلاحيات الصفحات
            </TabsTrigger>
            <TabsTrigger value="users" className="shrink-0 gap-2">
              <User className="w-4 h-4" />
              المستخدمين
            </TabsTrigger>
            <TabsTrigger value="barcode" className="shrink-0 gap-2">
              <Barcode className="w-4 h-4" />
              الباركود
            </TabsTrigger>
            <TabsTrigger value="printers" className="shrink-0 gap-2">
              <Printer className="w-4 h-4" />
              الطابعات
            </TabsTrigger>
            <TabsTrigger value="notifications" className="shrink-0 gap-2">
              <Bell className="w-4 h-4" />
              الإشعارات
            </TabsTrigger>
            <TabsTrigger value="backup" className="shrink-0 gap-2 whitespace-nowrap">
              <Database className="w-4 h-4" />
              النسخ الاحتياطي
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Shop Settings */}
        <TabsContent value="shop" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>معلومات المحل</CardTitle>
              <CardDescription>البيانات الأساسية للمحل</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>اسم المحل (عربي)</Label>
                  <Input defaultValue="محل الدجاج الطازج" />
                </div>
                <div className="space-y-2">
                  <Label>اسم المحل (إنجليزي)</Label>
                  <Input defaultValue="Fresh Chicken Shop" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input defaultValue="0599123456" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input type="email" defaultValue="shop@example.com" dir="ltr" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>العنوان</Label>
                  <Input defaultValue="شارع الرئيسي، رام الله" />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">الشعار</h3>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <Button variant="outline" className="gap-2">
                    <Upload className="w-4 h-4" />
                    رفع شعار
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>العملة</Label>
                  <Select defaultValue="ILS">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ILS">شيكل إسرائيلي (₪)</SelectItem>
                      <SelectItem value="USD">دولار أمريكي ($)</SelectItem>
                      <SelectItem value="JOD">دينار أردني</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>نسبة الضريبة الافتراضية (%)</Label>
                  <Input type="number" defaultValue="17" />
                </div>
                <div className="space-y-2">
                  <Label>بداية السنة المالية</Label>
                  <Select defaultValue="jan">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jan">يناير</SelectItem>
                      <SelectItem value="apr">أبريل</SelectItem>
                      <SelectItem value="jul">يوليو</SelectItem>
                      <SelectItem value="oct">أكتوبر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="gap-2">
                  <Save className="w-4 h-4" />
                  حفظ التغييرات
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Settings */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>تغيير كلمة المرور</CardTitle>
              <CardDescription>تحديث كلمة المرور الخاصة بك</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onChangePassword)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="oldPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>كلمة المرور الحالية</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <PasswordInput
                              placeholder="أدخل كلمة المرور الحالية"
                              disabled={changePasswordMutation.isPending}
                              {...field}
                              onBlur={(e) => {
                                field.onBlur();
                                checkOldPassword(e.target.value);
                              }}
                            />
                            {isCheckingPassword && (
                              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                            {!isCheckingPassword && oldPasswordValid === true && (
                              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                <div className="flex items-center gap-1">
                                  <div className="h-1 w-8 bg-green-500 rounded-full" />
                                  <Check className="h-4 w-4 text-green-500" />
                                </div>
                              </div>
                            )}
                            {!isCheckingPassword && oldPasswordValid === false && (
                              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                <X className="h-5 w-5 text-destructive" />
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>كلمة المرور الجديدة</FormLabel>
                        <FormControl>
                          <PasswordInput
                            placeholder="أدخل كلمة المرور الجديدة (8 أحرف على الأقل)"
                            disabled={changePasswordMutation.isPending}
                            {...field}
                          />
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
                          <PasswordInput
                            placeholder="أعد إدخال كلمة المرور الجديدة"
                            disabled={changePasswordMutation.isPending}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>ملاحظة:</strong> بعد تغيير كلمة المرور، سيتم تسجيل خروجك تلقائياً من جميع الأجهزة لأسباب أمنية.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      className="gap-2"
                      disabled={changePasswordMutation.isPending}
                    >
                      {changePasswordMutation.isPending ? (
                        <>
                          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          جاري الحفظ...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          حفظ كلمة المرور الجديدة
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accounting Settings - Blueprint 02 GL Engine */}
        <TabsContent value="accounting" className="space-y-6">
          <AccountingSettingsTab />
        </TabsContent>

        {/* Bank Accounts - BANK_AND_CHECKS_PLAN */}
        <TabsContent value="bank-accounts" className="space-y-6">
          <BankAccountsSettingsTab />
        </TabsContent>

        {/* Tax Templates - Blueprint 05 */}
        <TabsContent value="tax-templates" className="space-y-6">
          <TaxTemplatesTab />
        </TabsContent>

        {/* Page Access - Dynamic accountant permissions */}
        <TabsContent value="page-access" className="space-y-6">
          <PageAccessSettingsTab />
        </TabsContent>

        {/* Barcode Settings */}
        <TabsContent value="barcode" className="space-y-6">
          <BarcodeSettingsTab />
        </TabsContent>

        {/* Users Settings */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>إدارة المستخدمين</CardTitle>
              <CardDescription>إضافة وتعديل صلاحيات المستخدمين</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>سيتم إضافة إدارة المستخدمين قريباً</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Printers Settings */}
        <TabsContent value="printers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات الطابعة</CardTitle>
              <CardDescription>تكوين الطابعة الحرارية والأجهزة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>منفذ الطابعة (COM)</Label>
                  <Select defaultValue="com1">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="com1">COM1</SelectItem>
                      <SelectItem value="com2">COM2</SelectItem>
                      <SelectItem value="com3">COM3</SelectItem>
                      <SelectItem value="usb">USB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>معدل البود</Label>
                  <Select defaultValue="9600">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9600">9600</SelectItem>
                      <SelectItem value="19200">19200</SelectItem>
                      <SelectItem value="38400">38400</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>طباعة تلقائية بعد البيع</Label>
                  <p className="text-sm text-muted-foreground">طباعة الفاتورة تلقائياً</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>فتح الدرج تلقائياً</Label>
                  <p className="text-sm text-muted-foreground">فتح درج النقود عند البيع</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex gap-3">
                <Button variant="outline">اختبار الطباعة</Button>
                <Button className="gap-2">
                  <Save className="w-4 h-4" />
                  حفظ التغييرات
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات الإشعارات</CardTitle>
              <CardDescription>تخصيص التنبيهات والإشعارات</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>تنبيه المخزون المنخفض</Label>
                  <p className="text-sm text-muted-foreground">تنبيه عند انخفاض المخزون</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>تنبيه ديون الزبائن</Label>
                  <p className="text-sm text-muted-foreground">تنبيه عند استحقاق الديون</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>تنبيه ديون التجار</Label>
                  <p className="text-sm text-muted-foreground">تنبيه قبل موعد السداد</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex justify-end">
                <Button className="gap-2">
                  <Save className="w-4 h-4" />
                  حفظ التغييرات
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup Settings */}
        <TabsContent value="backup" className="space-y-6">
          <BackupSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
