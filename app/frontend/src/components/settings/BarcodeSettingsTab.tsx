import { useState, useEffect } from "react";
import { Save, Loader2, Barcode, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { barcodeService, type BarcodeConfig } from "@/services/barcode.service";
import { toast } from "sonner";

export function BarcodeSettingsTab() {
  const queryClient = useQueryClient();
  const [customEnabled, setCustomEnabled] = useState(true);
  const [totalLength, setTotalLength] = useState(25);
  const [itemCodeStart, setItemCodeStart] = useState(1);
  const [itemCodeLength, setItemCodeLength] = useState(6);
  const [weightStart, setWeightStart] = useState(7);
  const [weightLength, setWeightLength] = useState(5);
  const [totalPriceStart, setTotalPriceStart] = useState(12);
  const [totalPriceLength, setTotalPriceLength] = useState(7);
  const [priceStart, setPriceStart] = useState(19);
  const [priceLength, setPriceLength] = useState(5);
  const [testBarcode, setTestBarcode] = useState("");
  const [parseResult, setParseResult] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ["barcode", "config"],
    queryFn: () => barcodeService.getConfig(),
  });

  useEffect(() => {
    if (config) {
      setCustomEnabled(config.customEnabled);
      setTotalLength(config.totalLength);
      setItemCodeStart(config.itemCodeStart);
      setItemCodeLength(config.itemCodeLength);
      setWeightStart(config.weightStart);
      setWeightLength(config.weightLength);
      setTotalPriceStart(config.totalPriceStart);
      setTotalPriceLength(config.totalPriceLength);
      setPriceStart(config.priceStart);
      setPriceLength(config.priceLength);
    }
  }, [config]);

  const updateConfigMutation = useMutation({
    mutationFn: (data: Partial<BarcodeConfig>) => barcodeService.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barcode"] });
      toast.success("تم حفظ إعدادات الباركود بنجاح");
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { messageAr?: string } } })?.response?.data?.messageAr ||
        "فشل حفظ الإعدادات";
      toast.error(msg);
    },
  });

  const handleSave = () => {
    updateConfigMutation.mutate({
      customEnabled,
      totalLength,
      itemCodeStart,
      itemCodeLength,
      weightStart,
      weightLength,
      totalPriceStart,
      totalPriceLength,
      priceStart,
      priceLength,
    });
  };

  const handleTestParse = async () => {
    if (!testBarcode.trim()) {
      toast.error("أدخل باركود للاختبار");
      return;
    }
    setParseResult(null);
    try {
      const result = await barcodeService.parse(testBarcode.trim());
      setParseResult(
        `كود الصنف: ${result.itemCode} | الوزن: ${result.weightKg ?? "-"} كغ | السعر: ${result.price ?? "-"} | الإجمالي مع الضريبة: ${result.totalPriceWithTax ?? "-"}`
      );
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { messageAr?: string } } })?.response?.data?.messageAr ||
        "تعذر تحليل الباركود";
      setParseResult(`خطأ: ${msg}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Barcode className="w-5 h-5" />
          الباركود المخصص (25 رقم)
        </CardTitle>
        <CardDescription>
          تكوين تنسيق الباركود للمنتجات متغيرة الوزن
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">تفعيل الباركود المخصص</Label>
                <p className="text-sm text-muted-foreground">دعم 25 رقم للوزن والسعر</p>
              </div>
              <Switch checked={customEnabled} onCheckedChange={setCustomEnabled} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>طول الباركود</Label>
                <Input
                  type="number"
                  value={totalLength}
                  onChange={(e) => setTotalLength(parseInt(e.target.value) || 25)}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>كود الصنف</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="موضع البداية"
                    value={itemCodeStart}
                    onChange={(e) => setItemCodeStart(parseInt(e.target.value) || 0)}
                  />
                  <Input
                    type="number"
                    placeholder="الطول"
                    value={itemCodeLength}
                    onChange={(e) => setItemCodeLength(parseInt(e.target.value) || 6)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>الوزن (غرام)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="موضع البداية"
                    value={weightStart}
                    onChange={(e) => setWeightStart(parseInt(e.target.value) || 0)}
                  />
                  <Input
                    type="number"
                    placeholder="الطول"
                    value={weightLength}
                    onChange={(e) => setWeightLength(parseInt(e.target.value) || 5)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>السعر الإجمالي مع الضريبة</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="موضع البداية"
                    value={totalPriceStart}
                    onChange={(e) => setTotalPriceStart(parseInt(e.target.value) || 0)}
                  />
                  <Input
                    type="number"
                    placeholder="الطول"
                    value={totalPriceLength}
                    onChange={(e) => setTotalPriceLength(parseInt(e.target.value) || 7)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>السعر</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="موضع البداية"
                    value={priceStart}
                    onChange={(e) => setPriceStart(parseInt(e.target.value) || 0)}
                  />
                  <Input
                    type="number"
                    placeholder="الطول"
                    value={priceLength}
                    onChange={(e) => setPriceLength(parseInt(e.target.value) || 5)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <Label className="flex items-center gap-2">
                <TestTube className="w-4 h-4" />
                اختبار الباركود
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="أدخل باركود 25 رقم..."
                  value={testBarcode}
                  onChange={(e) => setTestBarcode(e.target.value)}
                  dir="ltr"
                  className="font-mono"
                />
                <Button variant="outline" onClick={handleTestParse}>
                  تحليل
                </Button>
              </div>
              {parseResult && (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                  {parseResult}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={updateConfigMutation.isPending}
                className="gap-2"
              >
                {updateConfigMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                حفظ التغييرات
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
