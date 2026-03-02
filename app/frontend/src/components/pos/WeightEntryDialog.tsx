/**
 * WeightEntryDialog — Numpad-based weight/quantity entry for POS
 * Opens when tapping a product card. Supports numpad, presets, and ±delta buttons.
 */
import { useState, useEffect } from "react";
import { Delete } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Item } from "@/types/inventory";

interface WeightEntryDialogProps {
  item: Item | null;            // null = closed
  initialKg?: number;           // pre-fill when editing cart item
  onConfirm: (item: Item, quantityKg: number) => void;
  onClose: () => void;
}

function toMajor(units: number): string {
  return (units / 100).toFixed(2);
}

const PRESETS: { label: string; value: number }[] = [
  { label: "250 غ",   value: 0.25 },
  { label: "500 غ",   value: 0.5  },
  { label: "750 غ",   value: 0.75 },
  { label: "1 كجم",   value: 1    },
  { label: "1.5 كجم", value: 1.5  },
  { label: "2 كجم",   value: 2    },
];

const DELTAS = [
  { label: "−½",  delta: -0.5  },
  { label: "−¼",  delta: -0.25 },
  { label: "+¼",  delta:  0.25 },
  { label: "+½",  delta:  0.5  },
];

const NUMPAD_ROWS = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  [".", "0", "⌫"],
];

export function WeightEntryDialog({
  item,
  initialKg,
  onConfirm,
  onClose,
}: WeightEntryDialogProps) {
  const [raw, setRaw] = useState<string>("");

  // Reset input whenever a new item is opened
  useEffect(() => {
    if (item) {
      setRaw(initialKg != null ? String(initialKg) : "");
    }
  }, [item, initialKg]);

  const qty = parseFloat(raw) || 0;
  const pricePerKg = item?.defaultSalePrice ?? 0;
  const total = Math.round(qty * pricePerKg);
  const grams = Math.round(qty * 1000);
  const isValid = qty >= 0.1;

  // ── Numpad handlers ────────────────────────────────────────
  const handleDigit = (d: string) => {
    if (d === ".") {
      if (raw.includes(".")) return;      // only one dot
      setRaw((p) => (p === "" ? "0." : p + "."));
      return;
    }
    // Don't allow more than 3 decimal places
    const dotIdx = raw.indexOf(".");
    if (dotIdx !== -1 && raw.length - dotIdx >= 4) return;
    // Replace a lone "0" with the new digit (no leading zeros like "07")
    if (raw === "0") { setRaw(d); return; }
    setRaw((p) => p + d);
  };

  const handleBackspace = () => setRaw((p) => p.slice(0, -1));

  const handleDelta = (delta: number) => {
    const next = Math.max(0.1, Math.round((qty + delta) * 1000) / 1000);
    setRaw(String(next));
  };

  const handlePreset = (value: number) => setRaw(String(value));

  const handleConfirm = () => {
    if (!item || !isValid) return;
    onConfirm(item, qty);
  };

  return (
    <Dialog open={!!item} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[340px] p-0 overflow-hidden" dir="rtl">

        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b">
          <DialogTitle className="text-base flex items-center gap-2">
            <span>⚖️</span>
            <span className="flex-1 truncate">{item?.name ?? ""}</span>
            <span className="text-sm font-normal text-muted-foreground whitespace-nowrap">
              ₪{toMajor(pricePerKg)} / كجم
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pt-3 pb-2 space-y-3">

          {/* ── Display ── */}
          <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-center border border-slate-200 dark:border-slate-700">
            <div className="flex items-baseline justify-center gap-2 min-h-[52px]">
              <span className="text-4xl font-extrabold tracking-tight font-mono text-foreground">
                {raw || <span className="text-muted-foreground/40">0</span>}
              </span>
              <span className="text-lg font-semibold text-muted-foreground">كجم</span>
            </div>
            <div className="flex items-center justify-center gap-4 mt-1 text-xs text-muted-foreground">
              <span>{grams} غرام</span>
              {qty > 0 && (
                <span className="text-primary font-bold text-sm">
                  المجموع: ₪{toMajor(total)}
                </span>
              )}
            </div>
          </div>

          {/* ── Preset buttons ── */}
          <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePreset(p.value)}
                className={`h-8 rounded-lg text-xs font-semibold border transition-colors ${
                  qty === p.value
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-background border-input hover:border-primary hover:text-primary"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* ── Delta (±) buttons ── */}
          <div className="grid grid-cols-4 gap-1.5">
            {DELTAS.map((b) => (
              <button
                key={b.label}
                onClick={() => handleDelta(b.delta)}
                className="h-8 rounded-lg text-xs font-bold border border-input bg-background hover:border-primary hover:text-primary transition-colors"
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* ── Numpad ── */}
          <div className="grid grid-cols-3 gap-2">
            {NUMPAD_ROWS.flat().map((key) => (
              <button
                key={key}
                onClick={() => key === "⌫" ? handleBackspace() : handleDigit(key)}
                className={`h-12 rounded-xl text-xl font-bold border transition-all active:scale-95 select-none ${
                  key === "⌫"
                    ? "border-input bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                    : "border-input bg-background hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-primary"
                }`}
              >
                {key === "⌫" ? <Delete className="w-4 h-4 mx-auto" /> : key}
              </button>
            ))}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex gap-2 px-4 pb-4">
          <Button variant="outline" className="flex-1 h-11" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            className="flex-1 h-11 text-base font-bold"
            disabled={!isValid}
            onClick={handleConfirm}
          >
            إضافة للسلة
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
