import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Barcode,
  User,
  Calculator,
  Printer,
  CreditCard,
  Banknote,
  X,
  Loader2,
  FileText,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useItems } from "@/hooks/use-inventory";
import { useCustomers } from "@/hooks/use-customers";
import { useCreateSale } from "@/hooks/use-sales";
import { TaxTemplateSelector } from "@/components/tax/TaxTemplateSelector";
import { ThermalReceipt } from "@/components/pos/ThermalReceipt";
import { CustomerSearchCombobox } from "@/components/pos/CustomerSearchCombobox";
import type { Item } from "@/types/inventory";
import type { Customer } from "@/types/customer";
import type { CreateSaleDto } from "@/types/sales";

/** Format minor units (e.g. 2200) as major (22.00) */
function toMajor(units: number): string {
  return (units / 100).toFixed(2);
}

/** Parse display value (e.g. "22.50") to minor units */
function toMinor(value: string | number): number {
  const n = typeof value === "string" ? parseFloat(value) || 0 : value;
  return Math.round(n * 100);
}

interface CartItem {
  itemId: number;
  name: string;
  pricePerKg: number; // minor units per kg
  quantityKg: number;
  total: number; // minor units
}

function POS() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState("");
  const [saleType, setSaleType] = useState<"cash" | "credit">("cash");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [taxTemplateId, setTaxTemplateId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const { data: itemsResp, isLoading: itemsLoading } = useItems({
    isActive: true,
    page: 1,
    pageSize: 100,
  });
  const { data: customersResp } = useCustomers({ isActive: true, pageSize: 500 });
  const createSale = useCreateSale();

  const items: Item[] = (itemsResp?.data ?? []).filter(i => (i.defaultSalePrice ?? 0) > 0);
  const customers: Customer[] = customersResp?.data ?? [];

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.nameEn ?? "").toLowerCase().includes(q) ||
        (i.code ?? "").toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  /** Add item with quantity in kg (supports float: 0.5, 1.5, 2.25...) */
  const addToCart = (item: Item, quantityKg: number = 1) => {
    const qty = Math.max(0.1, quantityKg); // min 0.1 kg
    const pricePerKg = item.defaultSalePrice ?? 0;
    const total = Math.round(qty * pricePerKg);
    const existing = cart.find((c) => c.itemId === item.id);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.itemId === item.id
            ? {
                ...c,
                quantityKg: Math.round((c.quantityKg + qty) * 100) / 100,
                total: Math.round((c.quantityKg + qty) * c.pricePerKg),
              }
            : c
        )
      );
    } else {
      setCart([
        ...cart,
        {
          itemId: item.id,
          name: item.name,
          pricePerKg,
          quantityKg: Math.round(qty * 100) / 100,
          total,
        },
      ]);
    }
  };

  const updateQuantity = (itemId: number, delta: number) => {
    setCart(
      cart
        .map((c) => {
          if (c.itemId !== itemId) return c;
          const newKg = Math.max(0.1, Math.round((c.quantityKg + delta) * 100) / 100);
          return {
            ...c,
            quantityKg: newKg,
            total: Math.round(newKg * c.pricePerKg),
          };
        })
        .filter((c) => c.quantityKg >= 0.1)
    );
  };

  const setCartItemQuantity = (itemId: number, quantityKg: number) => {
    const qty = Math.max(0.1, Math.round(quantityKg * 100) / 100);
    setCart(
      cart
        .map((c) =>
          c.itemId === itemId
            ? { ...c, quantityKg: qty, total: Math.round(qty * c.pricePerKg) }
            : c
        )
        .filter((c) => c.quantityKg >= 0.1)
    );
  };

  const removeFromCart = (itemId: number) => {
    setCart(cart.filter((c) => c.itemId !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerId(null);
    setCustomerName("");
    setCustomerPhone("");
    setSelectedCustomer(null);
    setDiscount(0);
    setPaidAmount("");
    setTaxTemplateId(null);
  };

  const handleCustomerSelect = (c: Customer | null) => {
    setSelectedCustomer(c);
    if (c) {
      setCustomerId(c.id);
      setCustomerName(c.name);
      setCustomerPhone(c.phone ?? "");
    } else {
      setCustomerId(null);
      setCustomerName("");
      setCustomerPhone("");
    }
  };

  const handlePrintReceipt = () => {
    const lines: string[] = [];
    lines.push("========================================");
    lines.push("        " + (receiptData.storeName || "نظام إدارة المحل"));
    lines.push("========================================");
    lines.push("التاريخ: " + receiptData.date);
    if (receiptData.customerName) lines.push("الزبون: " + receiptData.customerName);
    if (receiptData.customerPhone) lines.push("الهاتف: " + receiptData.customerPhone);
    lines.push("----------------------------------------");
    receiptData.items.forEach((i) => {
      lines.push(`${i.name} ${i.quantityKg.toFixed(2)} x ${(i.pricePerKg / 100).toFixed(2)} = ${(i.total / 100).toFixed(2)}`);
    });
    lines.push("----------------------------------------");
    lines.push(`المجموع: ${(receiptData.subtotal / 100).toFixed(2)}`);
    if (receiptData.discountAmount) lines.push(`الخصم: -${(receiptData.discountAmount / 100).toFixed(2)}`);
    if (receiptData.taxAmount) lines.push(`الضريبة: ${(receiptData.taxAmount / 100).toFixed(2)}`);
    lines.push(`الإجمالي: ₪ ${(receiptData.grandTotal / 100).toFixed(2)}`);
    if (receiptData.paidAmount) lines.push(`المدفوع: ₪ ${(receiptData.paidAmount / 100).toFixed(2)}`);
    if (receiptData.remainingAmount) lines.push(`المتبقي: ₪ ${(receiptData.remainingAmount / 100).toFixed(2)}`);
    lines.push("========================================");
    lines.push("           شكراً لكم");
    lines.push("========================================");

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.top = "0";
    iframe.style.width = "302px"; /* 80mm thermal printer width */
    iframe.style.height = "100dvh"; /* Consistent with CSS viewport in browser/WebView */
    iframe.style.border = "none";
    iframe.style.zIndex = "99999";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head><style>
          body{font-family:monospace;font-size:11px;padding:12px;margin:0;width:302px;}
          pre{white-space:pre-wrap;word-wrap:break-word;margin:0;}
        </style></head>
        <body><pre>${lines.join("\n")}</pre></body>
        </html>
      `);
      doc.close();
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };

  const subtotalMinor = cart.reduce((sum, c) => sum + c.total, 0);
  const discountAmountMinor = Math.round((subtotalMinor * discount) / 100);
  const netTotalMinor = subtotalMinor - discountAmountMinor;
  // Blueprint 05: estimated tax (15% for default template)
  const estimatedTaxMinor = taxTemplateId ? Math.round(netTotalMinor * 1500 / 10000) : 0;
  const grandTotalMinor = netTotalMinor + estimatedTaxMinor;
  const totalMinor = grandTotalMinor;
  const paidMinor = toMinor(paidAmount);
  const remainingMinor = saleType === "credit" ? totalMinor : Math.max(0, totalMinor - paidMinor);
  const overpayment = saleType === "cash" && paidMinor > 0 && paidMinor > totalMinor + 1;

  // Customer is required when: remaining > 0 (partial cash) OR deferred (credit)
  const needsCustomer = saleType === "credit" || (saleType === "cash" && paidMinor > 0 && paidMinor < totalMinor - 1);
  const hasCustomerInfo = !!customerId || (customerName.trim().length >= 2 && customerPhone.trim().length >= 7);
  const customerValid = !needsCustomer || hasCustomerInfo;

  // "Complete sale" button disabled conditions
  const canCompleteSale =
    cart.length > 0 &&
    !createSale.isPending &&
    !overpayment &&
    customerValid;

  const receiptData = useMemo(
    () => ({
      storeName: "ملحمة الفروج الذهبي",
      logoUrl: "/logo.jpeg",
      items: cart.map((c) => ({
        name: c.name,
        quantityKg: c.quantityKg,
        pricePerKg: c.pricePerKg,
        total: c.total,
      })),
      subtotal: subtotalMinor,
      discountAmount: discountAmountMinor,
      taxAmount: estimatedTaxMinor,
      grandTotal: totalMinor,
      paidAmount: paidMinor > 0 ? paidMinor : undefined,
      remainingAmount: remainingMinor > 0 ? remainingMinor : undefined,
      customerName: customerId ? customerName : customerName || undefined,
      customerPhone: customerPhone || undefined,
      saleType,
      date: new Date().toLocaleString("en-US"),
    }),
    [
      cart,
      subtotalMinor,
      discountAmountMinor,
      estimatedTaxMinor,
      totalMinor,
      paidMinor,
      remainingMinor,
      customerId,
      customerName,
      customerPhone,
      saleType,
    ]
  );

  const handleCompleteSale = async () => {
    if (!canCompleteSale) return;

    const dto: CreateSaleDto = {
      saleType,
      customerId: customerId ?? undefined,
      customerName: customerId ? undefined : (customerName || undefined),
      customerPhone: customerPhone || undefined,
      discountAmount: discountAmountMinor || undefined,
      taxTemplateId: taxTemplateId ?? undefined,
      lines: cart.map((c) => ({
        itemId: Number(c.itemId),
        weightGrams: Math.round(c.quantityKg * 1000),
        pricePerKg: Number(c.pricePerKg),
      })),
    };

    if (saleType === "cash") {
      // Use entered amount (supports partial payment); default to full total when empty
      const amount = Math.round(
        paidMinor > 0 ? Math.min(paidMinor, totalMinor) : totalMinor
      );
      if (amount > 0) {
        dto.payments = [
          {
            amount,
            paymentMethod: paymentMethod === "cash" ? "cash" : "card",
          },
        ];
      }
    }
    // credit (deferred): no payments array sent — entire amount becomes receivable

    try {
      await createSale.mutateAsync(dto);
      clearCart();
    } catch {
      // toast handled in useCreateSale
    }
  };

  return (
    <div className="-m-6 h-dvh overflow-hidden flex flex-col bg-slate-100 dark:bg-slate-950" dir="rtl">

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 h-14 px-5 flex items-center gap-4 bg-white dark:bg-slate-900 border-b shadow-sm">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Calculator className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-base font-bold text-foreground">نقطة البيع</span>
        </div>

        <div className="flex-1 max-w-xl relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="ابحث عن منتج بالاسم أو الكود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 h-9 text-sm bg-slate-50 dark:bg-slate-800"
          />
        </div>

        <div className="mr-auto flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" disabled>
            <Barcode className="w-3.5 h-3.5" /> باركود
          </Button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ═══ LEFT: Product Grid ══════════════════════════════════ */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4">
          {itemsLoading ? (
            <div className="flex items-center justify-center h-48 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>جاري تحميل المنتجات...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <Package className="w-10 h-10 opacity-30" />
              <span>لا توجد أصناف بعد</span>
              <span className="text-xs">أضف أصنافاً في صفحة المخزون أولاً</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <Search className="w-10 h-10 opacity-30" />
              <span>لا توجد منتجات تطابق البحث</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {filteredItems.map((item) => {
                const inCart = cart.find((c) => c.itemId === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="group relative flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-primary hover:shadow-md transition-all duration-150 text-right overflow-hidden"
                  >
                    {/* colour accent strip */}
                    <div className="h-1.5 w-full bg-primary/20 group-hover:bg-primary transition-colors" />
                    <div className="p-3 flex flex-col gap-1">
                      <span className="font-bold text-sm leading-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                        {item.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{item.code}</span>
                      <div className="mt-1.5 flex items-baseline justify-between">
                        <span className="text-base font-extrabold text-primary">
                          ₪{toMajor(item.defaultSalePrice ?? 0)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">/ كجم</span>
                      </div>
                    </div>
                    {inCart && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow">
                        {inCart.quantityKg}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Invoice Panel ════════════════════════════════ */}
        <div className="w-[500px] flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 shadow-xl">

          {/* ── Invoice Header ── */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="font-bold text-base">الفاتورة</span>
              {cart.length > 0 && (
                <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-bold">
                  {cart.length} صنف
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive gap-1 h-7 text-xs hover:bg-destructive/10">
                <X className="w-3.5 h-3.5" /> مسح الكل
              </Button>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden min-h-0">

            {/* ── Customer + Sale Type ── */}
            <div className={`flex-shrink-0 px-4 py-3 space-y-2.5 border-b ${
              needsCustomer && !hasCustomerInfo ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : ""
            }`}>
              {/* Inline warning when customer is required */}
              {needsCustomer && !hasCustomerInfo && (
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <User className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-semibold">
                    {saleType === "credit" ? "البيع الآجل يتطلب بيانات الزبون — اختر زبون مسجل أو أدخل الاسم والهاتف" : "الدفع الجزئي يتطلب بيانات الزبون — اختر زبون مسجل أو أدخل الاسم والهاتف"}
                  </span>
                </div>
              )}
              {/* Customer search/select */}
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <CustomerSearchCombobox
                    customers={customers}
                    value={selectedCustomer}
                    onSelect={handleCustomerSelect}
                    placeholder={needsCustomer ? "ابحث واختر زبون..." : "اختر زبون (اختياري)"}
                  />
                </div>
              </div>

              {/* Manual name + phone: visible when no registered customer selected */}
              {!customerId && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder={needsCustomer ? "اسم الزبون (حرفان على الأقل)" : "اسم الزبون"}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={`h-8 text-sm ${
                      needsCustomer && customerName.trim().length > 0 && customerName.trim().length < 2
                        ? "border-destructive"
                        : ""
                    }`}
                  />
                  <Input
                    placeholder={needsCustomer ? "رقم الهاتف (7 أرقام على الأقل)" : "الهاتف"}
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    dir="ltr"
                    className={`h-8 text-sm text-left ${
                      needsCustomer && customerPhone.trim().length > 0 && customerPhone.trim().length < 7
                        ? "border-destructive"
                        : ""
                    }`}
                  />
                </div>
              )}

              {/* Tax + Sale type in one row */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <TaxTemplateSelector
                    value={taxTemplateId}
                    onChange={setTaxTemplateId}
                    type="sales"
                    placeholder="بدون ضريبة"
                  />
                </div>
                <div className="flex gap-1 shrink-0">
                  {(["cash", "credit"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setSaleType(t);
                        if (t === "credit") setPaidAmount("");
                      }}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                        saleType === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-input text-muted-foreground hover:border-primary"
                      }`}
                    >
                      {t === "cash" ? "نقدي" : "آجل"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Cart Items (scrollable) ── */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Calculator className="w-8 h-8 opacity-40" />
                  </div>
                  <span className="text-sm">السلة فارغة — انقر على منتج لإضافته</span>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b z-10">
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-right py-2 px-4 font-medium w-[35%]">الصنف</th>
                      <th className="text-center py-2 px-2 font-medium">الكمية (كجم)</th>
                      <th className="text-center py-2 px-2 font-medium">السعر/كجم</th>
                      <th className="text-left py-2 px-4 font-medium">الإجمالي</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cart.map((item) => (
                      <tr key={item.itemId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-4">
                          <span className="font-semibold text-sm leading-tight line-clamp-2">{item.name}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateQuantity(item.itemId, -0.5)}
                              className="w-6 h-6 rounded border border-input flex items-center justify-center hover:bg-muted hover:border-primary transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={item.quantityKg}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v >= 0.1) setCartItemQuantity(item.itemId, v);
                              }}
                              className="w-14 h-6 px-1 rounded border border-input bg-background text-center text-xs font-bold"
                            />
                            <button
                              onClick={() => updateQuantity(item.itemId, 0.5)}
                              className="w-6 h-6 rounded border border-input flex items-center justify-center hover:bg-muted hover:border-primary transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center text-muted-foreground text-xs">
                          {toMajor(item.pricePerKg)}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-primary text-sm">
                          ₪{toMajor(item.total)}
                        </td>
                        <td className="py-2.5 pr-2">
                          <button
                            onClick={() => removeFromCart(item.itemId)}
                            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Totals & Payment ── */}
            <div className="flex-shrink-0 border-t bg-slate-50 dark:bg-slate-800/40">

              {/* Summary rows */}
              <div className="px-5 py-3 space-y-1.5 text-sm border-b">
                <div className="flex justify-between text-muted-foreground">
                  <span>المجموع الفرعي</span>
                  <span className="font-medium text-foreground">₪{toMajor(subtotalMinor)}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">خصم %</span>
                  <div className="flex items-center gap-2 mr-auto">
                    <Input
                      type="number"
                      value={discount || ""}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-20 h-7 text-center text-sm"
                      min={0} max={100}
                    />
                    {discountAmountMinor > 0 && (
                      <span className="text-destructive font-semibold text-xs shrink-0">
                        -₪{toMajor(discountAmountMinor)}
                      </span>
                    )}
                  </div>
                </div>

                {taxTemplateId && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>صافي قبل الضريبة</span>
                      <span className="font-medium text-foreground">₪{toMajor(netTotalMinor)}</span>
                    </div>
                    {estimatedTaxMinor > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>الضريبة</span>
                        <span className="font-medium text-foreground">₪{toMajor(estimatedTaxMinor)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Grand total */}
              <div className="px-5 py-3 flex items-center justify-between bg-primary/5 border-b border-primary/10">
                <span className="font-bold text-base">الإجمالي</span>
                <span className="text-3xl font-extrabold text-primary tracking-tight">₪{toMajor(totalMinor)}</span>
              </div>

              {/* Payment method + paid amount (cash only) */}
              {saleType === "cash" && (
                <div className="px-5 py-3 space-y-2 border-b">
                  <div className="flex gap-2">
                    {(["cash", "card"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-semibold border transition-colors ${
                          paymentMethod === m
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-input text-muted-foreground hover:border-primary"
                        }`}
                      >
                        {m === "cash" ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                        {m === "cash" ? "نقداً" : "بطاقة"}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground shrink-0">المبلغ المدفوع</span>
                    <Input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className={`flex-1 h-9 text-base font-bold text-center ${
                        overpayment ? "border-destructive" : ""
                      }`}
                      placeholder="0.00"
                    />
                    {overpayment ? (
                      <span className="text-destructive font-bold text-xs shrink-0">
                        المبلغ المدفوع أكبر من الإجمالي
                      </span>
                    ) : remainingMinor > 0 && paidMinor > 0 ? (
                      <span className="text-destructive font-bold text-sm shrink-0">
                        متبقي: ₪{toMajor(remainingMinor)}
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Deferred (credit) info banner */}
              {saleType === "credit" && (
                <div className="px-5 py-3 border-b bg-blue-50 dark:bg-blue-950/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">بيع آجل — المبلغ الكامل مستحق</span>
                    <span className="text-lg font-extrabold text-blue-700 dark:text-blue-300">₪{toMajor(totalMinor)}</span>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="px-4 py-3 flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs px-3"
                  disabled={cart.length === 0} onClick={() => setPreviewOpen(true)}>
                  <FileText className="w-3.5 h-3.5" /> معاينة
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs px-3"
                  disabled={cart.length === 0} onClick={handlePrintReceipt}>
                  <Printer className="w-3.5 h-3.5" /> طباعة
                </Button>
                <Button
                  className="flex-1 gap-2 h-9 text-sm font-bold"
                  disabled={!canCompleteSale}
                  onClick={handleCompleteSale}
                >
                  {createSale.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Calculator className="w-4 h-4" />}
                  إتمام البيع
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Receipt Preview Dialog ─────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[400px] p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>معاينة الفاتورة</DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-gray-100 flex justify-center">
            <ThermalReceipt data={receiptData} widthMm={80} className="shadow-lg" />
          </div>
          <div className="flex gap-2 p-4 pt-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={handlePrintReceipt} disabled={cart.length === 0}>
              <Printer className="w-4 h-4" /> طباعة
            </Button>
            <Button className="flex-1" onClick={() => setPreviewOpen(false)}>إغلاق</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default POS;
