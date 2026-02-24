import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Copy, RefreshCw, ArrowLeft } from "lucide-react";
import { useDailyPricing } from "@/hooks/use-daily-pricing";
import type { DailyPriceItem, DailyPricingResponse } from "@/types/daily-pricing";

interface DailyPricingGateProps {
  onContinue: (savedData: DailyPricingResponse) => void;
  onCancel?: () => void; // للرجوع دون حفظ (عند فتح من زر التعديل)
}

export function DailyPricingGate({ onContinue, onCancel }: DailyPricingGateProps) {
  const todayStr = new Date().toISOString().split("T")[0];
  const {
    data,
    isLoading,
    yesterdayHasPrices,
    setPricing,
    setPricingLoading,
    copyFromYesterday,
    copyFromYesterdayLoading,
    toMajor,
    toMinor,
  } = useDailyPricing(todayStr);

  const [prices, setPrices] = useState<Record<number, number>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (data?.items) {
      const map: Record<number, number> = {};
      data.items.forEach((i) => {
        map[i.itemId] = i.pricePerKg;
      });
      setPrices(map);
      setInitialized(true);
    }
  }, [data?.items]);

  const handleCopyYesterday = async () => {
    try {
      const res = await copyFromYesterday(todayStr);
      if (res?.items) {
        const map: Record<number, number> = {};
        res.items.forEach((i) => {
          map[i.itemId] = i.pricePerKg;
        });
        setPrices(map);
      }
    } catch {
      /* toast */
    }
  };

  const handleUseDefaults = () => {
    if (!data?.items) return;
    const map: Record<number, number> = {};
    data.items.forEach((i) => {
      map[i.itemId] = i.defaultSalePrice;
    });
    setPrices(map);
  };

  const handleContinue = async () => {
    const dto = {
      date: todayStr,
      prices: Object.entries(prices).map(([itemId, pricePerKg]) => ({
        itemId: Number(itemId),
        pricePerKg,
      })),
    };
    try {
      const saved = await setPricing(dto);
      onContinue(saved);
    } catch {
      /* toast */
    }
  };

  const updatePrice = (itemId: number, value: string) => {
    const minor = toMinor(value);
    setPrices((prev) => ({ ...prev, [itemId]: minor }));
  };

  if (isLoading || !data) {
    return (
      <div
        className="min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center gap-4"
        dir="rtl"
      >
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <span className="text-lg text-muted-foreground">
          جاري تحميل أسعار اليوم...
        </span>
      </div>
    );
  }

  return (
    <div
      className="min-h-[calc(100vh-3rem)] flex flex-col bg-gradient-to-br from-slate-50 via-background to-primary/5 p-6"
      dir="rtl"
    >
      <div className="max-w-3xl mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">تسعير اليوم</h1>
          <p className="text-muted-foreground">
            حدّد أسعار البيع لليوم — {todayStr}
          </p>
        </div>

        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right font-bold">المنتج</TableHead>
                <TableHead className="text-right font-bold w-32">
                  السعر (ش.إ / كجم)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item: DailyPriceItem) => (
                <TableRow key={item.itemId}>
                  <TableCell className="font-medium text-right">
                    {item.itemName}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      dir="ltr"
                      className="text-left font-mono"
                      value={initialized ? toMajor(prices[item.itemId] ?? item.defaultSalePrice) : toMajor(item.pricePerKg)}
                      onChange={(e) =>
                        updatePrice(item.itemId, e.target.value)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          {onCancel && (
            <Button variant="ghost" size="lg" onClick={onCancel}>
              رجوع
            </Button>
          )}
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={handleCopyYesterday}
            disabled={!yesterdayHasPrices || copyFromYesterdayLoading}
          >
            {copyFromYesterdayLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
            استعمال تسعيرة الأمس
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={handleUseDefaults}
          >
            <RefreshCw className="w-5 h-5" />
            استخدام الأسعار الافتراضية
          </Button>
          <Button
            size="lg"
            className="gap-2"
            onClick={handleContinue}
            disabled={setPricingLoading}
          >
            {setPricingLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowLeft className="w-5 h-5" />
            )}
            متابعة للبيع
          </Button>
        </div>

        {!yesterdayHasPrices && (
          <p className="text-sm text-muted-foreground text-center">
            لا توجد تسعيرة محفوظة لأمس — استخدم الأسعار الافتراضية أو عدّل يدوياً
          </p>
        )}
      </div>
    </div>
  );
}
