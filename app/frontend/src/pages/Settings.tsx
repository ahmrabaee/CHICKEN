import { Save, Upload, User, Bell, Printer, Globe } from "lucide-react";
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

export default function Settings() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-muted-foreground mt-1">إدارة إعدادات النظام والمحل</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="shop" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="shop" className="gap-2">
            <Globe className="w-4 h-4" />
            المحل
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <User className="w-4 h-4" />
            المستخدمين
          </TabsTrigger>
          <TabsTrigger value="printers" className="gap-2">
            <Printer className="w-4 h-4" />
            الطابعات
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            الإشعارات
          </TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}
