import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Trash2, Loader2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useSourceLots, useTransferrableProducts, useCreateStockTransfer } from "@/hooks/use-stock-transfer";
import type { CreateStockTransferDto, StockTransferLineDto } from "@/services/stock-transfer.service";

function formatCurrency(v: number) {
  return `₪ ${(v / 100).toFixed(2)}`;
}

export default function StockTransferProfile() {
  const navigate = useNavigate();
  const createTransfer = useCreateStockTransfer();

  const { data: sourceLots = [], isLoading: lotsLoading, isError: lotsError } = useSourceLots();
  const { data: products = [], isLoading: productsLoading } = useTransferrableProducts();

  const [sourceLotId, setSourceLotId] = useState<number | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Array<{ itemId: number; weightGrams: number; unitCost: number }>>([]);

  const selectedLot = sourceLots.find((l) => l.id === sourceLotId);
  const maxGrams = selectedLot?.remainingQuantityGrams ?? 0;
  const totalGrams = lines.reduce((s, l) => s + l.weightGrams, 0);
  const totalCost = useMemo(
    () => lines.reduce((s, l) => s + Math.round((l.weightGrams / 1000) * l.unitCost), 0),
    [lines]
  );
  const exceedsMax = totalGrams > maxGrams;

  const addLine = () => {
    const first = products[0];
    if (first) {
      setLines((prev) => [
        ...prev,
        {
          itemId: first.id,
          weightGrams: 0,
          unitCost: first.defaultPurchasePrice ?? first.defaultSalePrice ?? 0,
        },
      ]);
    }
  };

  const updateLine = (idx: number, updates: Partial<{ itemId: number; weightGrams: number; unitCost: number }>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...updates } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = () => {
    if (!sourceLotId || lines.length === 0) return;
    if (exceedsMax) return;

    const validLines = lines.filter((l) => l.itemId > 0 && l.weightGrams > 0);
    if (validLines.length === 0) return;

    const payload: CreateStockTransferDto = {
      sourceLotId,
      expiryDate: expiryDate.trim() || undefined,
      notes: notes.trim() || undefined,
      lines: validLines.map((l, i) => ({
        itemId: l.itemId,
        weightGrams: l.weightGrams,
        unitCost: l.unitCost,
        lineNumber: i + 1,
      })),
    };

    createTransfer.mutate(payload, {
      onSuccess: () => navigate("/stock-transfer"),
    });
  };

  const canSubmit =
    sourceLotId &&
    lines.some((l) => l.weightGrams > 0) &&
    !exceedsMax &&
    !createTransfer.isPending;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-4">
        <Link to="/stock-transfer" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">تحويل المخزون</h1>
          <p className="text-muted-foreground mt-1">تحويل كيلوهات من منتج إلى منتج آخر</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">المنتج المصدر والدفعة</label>
              <Select
                value={sourceLotId ? String(sourceLotId) : ""}
                onValueChange={(v) => (v && v !== "_none" ? setSourceLotId(Number(v)) : setSourceLotId(null))}
                disabled={lotsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={lotsLoading ? "جاري التحميل..." : sourceLots.length === 0 ? "لا توجد دفعات متاحة" : "اختر المنتج والدفعة"} />
                </SelectTrigger>
                <SelectContent sideOffset={4} className="max-h-[280px]">
                  {sourceLots.length === 0 ? (
                    <SelectItem value="_none" disabled className="text-center cursor-default">
                      <span className="text-muted-foreground">لا توجد دفعات متاحة.</span>
                      <Link to="/purchasing" className="text-primary underline text-xs mt-1 block" onClick={(e) => e.stopPropagation()}>
                        قم بإضافة مخزون من المشتريات أو التحويلات
                      </Link>
                    </SelectItem>
                  ) : (
                    sourceLots.map((lot) => (
                      <SelectItem key={lot.id} value={String(lot.id)}>
                        {lot.itemName} — {lot.lotNumber} — {lot.remainingKg} كجم متاح
                        {lot.purchaseNumber ? ` (${lot.purchaseNumber})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {lotsLoading && (
                <p className="text-xs text-muted-foreground mt-1">جاري تحميل الدفعات...</p>
              )}
              {!lotsLoading && lotsError && (
                <p className="text-xs text-destructive mt-1">فشل تحميل الدفعات. تحقق من الاتصال والصّلاحيات.</p>
              )}
              {!lotsLoading && !lotsError && sourceLots.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                  لا توجد دفعات متاحة. قم بإضافة مخزون من المشتريات أو التحويلات.
                </p>
              )}
              {selectedLot && (
                <p className="text-xs text-muted-foreground mt-1">
                  المتاح: {selectedLot.remainingKg} كجم — سعر الكيلو: {formatCurrency(selectedLot.unitPurchasePrice)}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">تاريخ الصلاحية (اختياري)</label>
              <DatePicker
                value={expiryDate}
                onChange={setExpiryDate}
                placeholder="يُستخدم صلاحية الدفعة إن لم يُحدد"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">التوزيع على المنتجات</label>
              <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={productsLoading}>
                <Plus className="w-4 h-4 mr-1" />
                إضافة سطر
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead className="w-32">الكمية (كجم)</TableHead>
                  <TableHead className="w-32">التكلفة/كجم</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Select
                        value={String(line.itemId)}
                        onValueChange={(v) => updateLine(idx, { itemId: Number(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر المنتج" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <NumericInput
                        
                        step="0.001"
                        min="0"
                        value={line.weightGrams ? line.weightGrams / 1000 : ""}
                        onChange={(e) => {
                          const kg = parseFloat(e.target.value) || 0;
                          updateLine(idx, { weightGrams: Math.round(kg * 1000) });
                        }}
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell>
                      <NumericInput
                        
                        min="0"
                        value={line.unitCost ? line.unitCost / 100 : ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          updateLine(idx, { unitCost: Math.round(v * 100) });
                        }}
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeLine(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {lines.length > 0 && (
              <div className="flex items-center justify-between mt-4 p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">
                  المجموع: {(totalGrams / 1000).toFixed(2)} كجم
                  {maxGrams > 0 && (
                    <span className={exceedsMax ? "text-destructive mr-2" : "text-muted-foreground mr-2"}>
                      {exceedsMax ? ` (يتجاوز المتاح ${maxGrams / 1000} كجم)` : ` / ${maxGrams / 1000} كجم متاح`}
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold">{formatCurrency(totalCost)}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">ملاحظات</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اختياري"
              rows={2}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button onClick={onSubmit} disabled={!canSubmit}>
              {createTransfer.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              تنفيذ التحويل
            </Button>
            <Button variant="outline" onClick={() => navigate("/stock-transfer")}>
              إلغاء
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
