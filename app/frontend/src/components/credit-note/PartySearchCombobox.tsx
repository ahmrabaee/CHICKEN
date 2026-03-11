/**
 * Party Search Combobox for Credit Notes
 * Searchable dropdown for Customer or Supplier based on partyType
 */
import { useState, useMemo } from "react";
import { Search, ChevronDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types/customer";
import type { Supplier } from "@/types/supplier";

type Party = { id: number; name: string; phone?: string | null };

interface PartySearchComboboxProps {
  partyType: "customer" | "supplier";
  customers?: Customer[];
  suppliers?: Supplier[];
  value: Party | null;
  onSelect: (party: Party | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

function toParty(c: Customer): Party {
  return { id: c.id, name: c.name, phone: c.phone };
}
function toPartyFromSupplier(s: Supplier): Party {
  return { id: s.id, name: s.name, phone: s.phone };
}

export function PartySearchCombobox({
  partyType,
  customers = [],
  suppliers = [],
  value,
  onSelect,
  placeholder,
  disabled = false,
}: PartySearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const parties: Party[] = useMemo(() => {
    if (partyType === "customer") return customers.map(toParty);
    return suppliers.map(toPartyFromSupplier);
  }, [partyType, customers, suppliers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return parties.slice(0, 50);
    const q = search.toLowerCase();
    return parties
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.phone ?? "").includes(q)
      )
      .slice(0, 50);
  }, [parties, search]);

  const displayLabel = value
    ? `${value.name}${value.phone ? ` (${value.phone})` : ""}`
    : null;

  const searchPlaceholder =
    partyType === "customer"
      ? "ابحث بالاسم أو الهاتف..."
      : "ابحث بالاسم أو الهاتف...";

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
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(380px,calc(100vw-2rem))] p-0"
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
        <ScrollArea className="h-[240px]">
          <div className="p-1">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground" dir="rtl">
                {search.trim() ? "لا توجد نتائج للبحث" : "لا يوجد أطراف"}
              </div>
            ) : (
              filtered.map((p) => {
                const isSelected = value?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={cn(
                      "w-full px-3 py-3 text-right rounded-lg border transition-colors flex items-center gap-2",
                      isSelected
                        ? "bg-primary/10 border-primary/30"
                        : "hover:bg-accent border-transparent hover:border-accent"
                    )}
                    onClick={() => {
                      onSelect(p);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0 text-right">
                      <div className="font-medium truncate">{p.name}</div>
                      {p.phone && (
                        <div className="text-xs text-muted-foreground">{p.phone}</div>
                      )}
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
