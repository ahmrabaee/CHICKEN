import { AlertCircle, BarChart3, RefreshCw } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/formatters";
import type { SalesChartPoint } from "@/components/dashboard/types";

interface ChartCardProps {
  data: SalesChartPoint[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  rangeLabel: string;
}

const chartConfig = {
  revenue: { label: "الإيراد", color: "hsl(var(--primary))" },
  profit: { label: "الربح", color: "#059669" },
} as const;

export function ChartCard({ data, isLoading, isError, onRetry, rangeLabel }: ChartCardProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          المبيعات عبر الزمن
        </CardTitle>
        <p className="text-xs text-muted-foreground">{rangeLabel}</p>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-[260px] w-full rounded-lg" />
          </div>
        )}

        {!isLoading && isError && (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-6 w-6 text-rose-600" />
            <p className="text-sm text-rose-700">تعذر تحميل بيانات الرسم البياني.</p>
            <Button variant="outline" className="gap-2" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              إعادة المحاولة
            </Button>
          </div>
        )}

        {!isLoading && !isError && data.length === 0 && (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">لا توجد مبيعات للفترة المحددة.</p>
            <Button variant="outline" asChild>
              <Link to="/sales/new">تسجيل عملية بيع</Link>
            </Button>
          </div>
        )}

        {!isLoading && !isError && data.length > 0 && (
          <div dir="rtl" aria-label="مخطط المبيعات والإرباح حسب اليوم">
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <LineChart data={data} margin={{ left: 8, right: 8, top: 16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayLabel" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Math.round((Number(value) || 0) / 100)}₪`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [formatCurrency(Number(value) || 0), name]}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  strokeWidth={2.5}
                  dot={false}
                  name="الإيراد"
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="var(--color-profit)"
                  strokeWidth={2.5}
                  dot={false}
                  name="الربح"
                />
              </LineChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
