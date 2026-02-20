/**
 * Customer Search Combobox for POS
 * Search by name or phone, select from filtered list
 */
import { useState, useMemo } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Customer } from "@/types/customer";

interface CustomerSearchComboboxProps {
  customers: Customer[];
  value: Customer | null;
  onSelect: (c: Customer | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CustomerSearchCombobox({
  customers,
  value,
  onSelect,
  placeholder = "اختر زبون أو ابحث...",
  disabled = false,
}: CustomerSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return customers.slice(0, 30);
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q)
    ).slice(0, 30);
  }, [customers, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-11"
          disabled={disabled}
        >
          <span className="truncate">
            {value ? `${value.name}${value.phone ? ` (${value.phone})` : ""}` : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم أو الهاتف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
              dir="rtl"
            />
          </div>
        </div>
        <ScrollArea className="h-[200px]">
          <div className="p-1">
            <button
              type="button"
              className="w-full px-3 py-2 text-right text-sm hover:bg-accent rounded-md"
              onClick={() => {
                onSelect(null);
                setOpen(false);
                setSearch("");
              }}
            >
              زبون عادي (Walk-in)
            </button>
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`w-full px-3 py-2 text-right text-sm rounded-md ${
                  value?.id === c.id ? "bg-accent" : "hover:bg-accent"
                }`}
                onClick={() => {
                  onSelect(c);
                  setOpen(false);
                  setSearch("");
                }}
              >
                {c.name} {c.phone ? `(${c.phone})` : ""}
              </button>
            ))}
            {filtered.length === 0 && search.trim() && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                لا توجد نتائج
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
