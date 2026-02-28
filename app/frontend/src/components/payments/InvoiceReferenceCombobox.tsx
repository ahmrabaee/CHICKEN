/**
 * Invoice/Purchase Reference Combobox for Payment Form
 * Searchable dropdown: فاتورة مبيعات أو أمر شراء — يظهر اسم العميل/التاجر بوضوح
 */
import { useState, useMemo } from "react";
import { Search, ChevronDown, User, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface SaleOption {
  id: number;
  saleNumber: string;
  customerName?: string;
  totalAmount: number;
  amountPaid: number;
}

export interface PurchaseOption {
  id: number;
  purchaseNumber: string;
  supplierName?: string;
  grandTotal: number;
  amountPaid: number;
}

type InvoiceReferenceComboboxProps =
  | {
      type: "sale";
      options: SaleOption[];
      value: number | undefined;
      onSelect: (id: number | undefined) => void;
      placeholder?: string;
      disabled?: boolean;
    }
  | {
      type: "purchase";
      options: PurchaseOption[];
      value: number | undefined;
      onSelect: (id: number | undefined) => void;
      placeholder?: string;
      disabled?: boolean;
    };

function formatAmount(v: number) {
  return `₪ ${(v / 100).toFixed(2)}`;
}

export function InvoiceReferenceCombobox(props: InvoiceReferenceComboboxProps) {
  const { type, value, onSelect, placeholder, disabled = false } = props;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const options = props.options;

  const filtered = useMemo(() => {
    if (!search.trim()) return options.slice(0, 50);
    const q = search.toLowerCase().trim();
    if (type === "sale") {
      return (options as SaleOption[]).filter(
        (s) =>
          s.saleNumber.toLowerCase().includes(q) ||
          (s.customerName ?? "").toLowerCase().includes(q)
      );
    }
    return (options as PurchaseOption[]).filter(
      (p) =>
        p.purchaseNumber.toLowerCase().includes(q) ||
        (p.supplierName ?? "").toLowerCase().includes(q)
    );
  }, [options, search, type]);

  const selected =
    type === "sale"
      ? (options as SaleOption[]).find((s) => s.id === value)
      : (options as PurchaseOption[]).find((p) => p.id === value);

  const displayLabel = selected
    ? type === "sale"
      ? `${(selected as SaleOption).saleNumber} — ${(selected as SaleOption).customerName || "زبون"}`
      : `${(selected as PurchaseOption).purchaseNumber} — ${(selected as PurchaseOption).supplierName || "مورد"}`
    : null;

  const searchPlaceholder =
    type === "sale"
      ? "ابحث برقم الفاتورة أو اسم العميل..."
      : "ابحث برقم الأمر أو اسم المورد...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-11 min-h-11",
            !displayLabel && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <span className="truncate text-right">
            {displayLabel || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50 mr-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(420px,calc(100vw-2rem))] p-0"
        align="start"
      >
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
              dir="rtl"
            />
          </div>
        </div>
        <ScrollArea className="h-[280px]">
          <div className="p-1">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground" dir="rtl">
                {search.trim()
                  ? "لا توجد نتائج للبحث"
                  : type === "sale"
                    ? "لا توجد فواتير بمبلغ متبقٍ"
                    : "لا توجد أوامر شراء بمبلغ متبقٍ"}
              </div>
            ) : (
              filtered.map((item) => {
                const isSale = type === "sale";
                const s = item as SaleOption;
                const p = item as PurchaseOption;
                const remaining = isSale
                  ? s.totalAmount - s.amountPaid
                  : p.grandTotal - p.amountPaid;
                const isSelected = item.id === value;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "w-full px-3 py-3 text-right rounded-lg border transition-colors",
                      isSelected
                        ? "bg-primary/10 border-primary/30"
                        : "hover:bg-accent border-transparent hover:border-accent"
                    )}
                    onClick={() => {
                      onSelect(item.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={cn(
                          "flex-shrink-0 mt-0.5 p-1.5 rounded-md",
                          isSale ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
                        )}
                      >
                        {isSale ? (
                          <FileText className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {isSale ? s.saleNumber : p.purchaseNumber}
                          </span>
                          <span className="font-semibold text-emerald-600 text-sm">
                            {formatAmount(remaining)}
                          </span>
                        </div>
                        <p className="font-medium text-sm mt-0.5 truncate">
                          {isSale ? s.customerName || "زبون" : p.supplierName || "مورد"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
