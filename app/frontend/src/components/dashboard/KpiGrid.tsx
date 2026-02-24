import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { DashboardKpiItem } from "@/components/dashboard/types";

interface KpiGridProps {
  items: DashboardKpiItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

const toneClasses: Record<DashboardKpiItem["tone"], string> = {
  default: "from-primary/10 to-primary/5 text-primary",
  success: "from-emerald-500/10 to-emerald-500/5 text-emerald-600",
  warning: "from-amber-500/10 to-amber-500/5 text-amber-600",
  danger: "from-rose-500/10 to-rose-500/5 text-rose-600",
  info: "from-sky-500/10 to-sky-500/5 text-sky-600",
};

function DeltaBadge({ pct, direction }: { pct: number | null; direction: DashboardKpiItem["deltaDirection"] }) {
  if (pct == null) {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs text-muted-foreground">
        —
      </span>
    );
  }

  const icon =
    direction === "up" ? (
      <ArrowUpRight className="h-3.5 w-3.5" />
    ) : direction === "down" ? (
      <ArrowDownRight className="h-3.5 w-3.5" />
    ) : (
      <ArrowRightLeft className="h-3.5 w-3.5" />
    );

  const badgeTone =
    direction === "up"
      ? "border-emerald-300/60 bg-emerald-500/10 text-emerald-700"
      : direction === "down"
        ? "border-rose-300/60 bg-rose-500/10 text-rose-700"
        : "border-slate-300/60 bg-slate-500/10 text-slate-700";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium", badgeTone)}>
      {icon}
      {pct.toFixed(1)}%
    </span>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={`kpi-skeleton-${index}`} className={cn("h-full min-h-[150px]", index >= 4 ? "xl:col-span-2" : "")}>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function KpiGrid({ items, isLoading, isError, onRetry }: KpiGridProps) {
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null);
  const activeItem = useMemo(
    () => items.find((item) => item.key === activeItemKey) ?? null,
    [activeItemKey, items],
  );

  if (isLoading) return <KpiSkeleton />;

  if (isError) {
    return (
      <Card className="border-rose-200/70 bg-rose-50/40">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="h-6 w-6 text-rose-600" />
          <p className="text-sm text-rose-700">تعذر تحميل ملخص المؤشرات. حاول مرة أخرى.</p>
          <Button variant="outline" className="gap-2" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          لا توجد بيانات مؤشرات لهذه الفترة.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.key}
              onClick={() => setActiveItemKey(item.key)}
              className={cn(
                "group text-right outline-none",
                item.size === "wide" ? "xl:col-span-2" : "",
              )}
              aria-label={`عرض تفاصيل ${item.title}`}
            >
              <Card className="h-full min-h-[150px] border-border/60 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-active:translate-y-0 group-focus-visible:ring-2 group-focus-visible:ring-primary/40">
                <CardContent className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br", toneClasses[item.tone])}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <DeltaBadge pct={item.deltaPct} direction={item.deltaDirection} />
                  </div>
                  <p className="text-2xl font-black tracking-tight text-foreground">{item.value}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground/90">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <Sheet open={!!activeItem} onOpenChange={(open) => !open && setActiveItemKey(null)}>
        <SheetContent side="left" className="w-full max-w-md overflow-y-auto" dir="rtl">
          {activeItem && (
            <>
              <SheetHeader className="text-right">
                <SheetTitle>{activeItem.title}</SheetTitle>
                <SheetDescription>{activeItem.subtitle}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">القيمة الحالية</p>
                  <p className="mt-1 text-3xl font-black">{activeItem.value}</p>
                  <div className="mt-3">
                    <DeltaBadge pct={activeItem.deltaPct} direction={activeItem.deltaDirection} />
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <h3 className="mb-3 text-sm font-semibold">تفاصيل سريعة</h3>
                  <ul className="space-y-2 text-sm">
                    {activeItem.details.map((detail) => (
                      <li key={`${activeItem.key}-${detail.label}`} className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0">
                        <span className="text-muted-foreground">{detail.label}</span>
                        <span className="font-semibold text-foreground">{detail.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {activeItem.actionTo && activeItem.actionLabel && (
                  <Link to={activeItem.actionTo} className="block">
                    <Button className="w-full">{activeItem.actionLabel}</Button>
                  </Link>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
