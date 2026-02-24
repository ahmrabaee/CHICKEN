import { Search, RotateCcw, CalendarRange, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Branch } from "@/types/branch";
import type { DashboardFilters } from "@/components/dashboard/types";

interface FiltersBarProps {
  filters: DashboardFilters;
  branches: Branch[];
  onChange: (patch: Partial<DashboardFilters>) => void;
  onReset: () => void;
}

const rangeOptions: Array<{ value: DashboardFilters["range"]; label: string }> = [
  { value: "today", label: "اليوم" },
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "هذا الشهر" },
  { value: "custom", label: "مخصص" },
];

export function FiltersBar({ filters, branches, onChange, onReset }: FiltersBarProps) {
  const hasBranchFilter = branches.length > 1;

  return (
    <section
      dir="rtl"
      aria-label="شريط فلاتر لوحة التحكم"
      className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">الفترة الزمنية</label>
          <Select
            value={filters.range}
            onValueChange={(value) => onChange({ range: value as DashboardFilters["range"] })}
          >
            <SelectTrigger className="h-10" aria-label="اختر الفترة الزمنية">
              <CalendarRange className="ms-2 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {rangeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filters.range === "custom" && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">من تاريخ</label>
              <DatePicker
                value={filters.startDate}
                onChange={(startDate) => onChange({ startDate })}
                placeholder="حدد تاريخ البداية"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">إلى تاريخ</label>
              <DatePicker
                value={filters.endDate}
                onChange={(endDate) => onChange({ endDate })}
                placeholder="حدد تاريخ النهاية"
              />
            </div>
          </>
        )}

        {hasBranchFilter && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">الفرع</label>
            <Select
              value={filters.branchId ? String(filters.branchId) : "all"}
              onValueChange={(value) =>
                onChange({ branchId: value === "all" ? undefined : Number(value) })
              }
            >
              <SelectTrigger className="h-10" aria-label="اختر الفرع">
                <Building2 className="ms-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="كل الفروع" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">كل الفروع</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={String(branch.id)}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">بحث بالجداول</label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={filters.search}
              onChange={(event) => onChange({ search: event.target.value })}
              placeholder="ابحث باسم الزبون أو الصنف..."
              className="h-10 pr-9"
              aria-label="بحث داخل جداول لوحة التحكم"
            />
          </div>
        </div>

        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full gap-2"
            onClick={onReset}
            aria-label="إعادة ضبط الفلاتر"
          >
            <RotateCcw className="h-4 w-4" />
            إعادة ضبط الفلاتر
          </Button>
        </div>
      </div>
    </section>
  );
}
