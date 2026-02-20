import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Scale,
  Barcode,
  User,
  Calculator,
  Printer,
  CreditCard,
  Banknote,
  X,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
  const [saleType, setSaleType] = useState<"cash" | "credit" | "mixed">("cash");
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

  const items: Item[] = itemsResp?.data ?? [];
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
    iframe.style.width = "302px";
    iframe.style.height = "100%";
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
  const remainingMinor = Math.max(0, totalMinor - paidMinor);

  const receiptData = useMemo(
    () => ({
      storeName: "نظام إدارة المحل",
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
      date: new Date().toLocaleString("ar-EG"),
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
    if (cart.length === 0) return;

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

    if (saleType === "cash" || saleType === "mixed") {
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

    try {
      await createSale.mutateAsync(dto);
      clearCart();
    } catch {
      // toast handled in useCreateSale
    }
  };

  return (
    <div className="min-h-[calc(100vh-3rem)] flex flex-col bg-gradient-to-br from-slate-50 via-background to-primary/5" dir="rtl">
      {/* Top Bar - Full Width */}
      <div className="flex-shrink-0 px-6 py-4 bg-card/95 backdrop-blur border-b shadow-sm">
        <div className="flex items-center gap-6 max-w-[2000px] mx-auto">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">نقطة البيع</h1>
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="ابحث عن منتج بالاسم أو الكود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pr-12 text-base rounded-xl border-2 focus-visible:ring-2"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="gap-2 rounded-xl" disabled>
              <Barcode className="w-5 h-5" />
              مسح باركود
            </Button>
            <Button variant="outline" size="lg" className="gap-2 rounded-xl" disabled>
              <Scale className="w-5 h-5" />
              ميزان
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Flex Row (stacked on mobile) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-0 overflow-hidden">
        {/* Left: Products Grid - Takes ~55% */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6">
          {itemsLoading ? (
            <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-lg">جاري تحميل المنتجات...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <Search className="w-10 h-10" />
              </div>
              <span className="text-lg">لا توجد منتجات تطابق البحث</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="group relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-card border-2 border-border hover:border-primary hover:bg-primary/5 hover:shadow-lg transition-all duration-200 min-h-[140px] text-center"
                >
                  <span className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{item.name}</span>
                  <span className="text-xl font-extrabold text-primary">
                    ₪ {toMajor(item.defaultSalePrice ?? 0)}
                  </span>
                  <span className="text-sm text-muted-foreground">/ كجم</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Cart Panel - Takes ~45% on desktop, full width on mobile */}
        <div className="w-full lg:w-[45%] xl:min-w-[520px] min-h-[400px] lg:min-h-0 flex flex-col bg-card border-l shadow-2xl">
          <div className="flex-shrink-0 px-8 py-6 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">الفاتورة</h2>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={clearCart}
                  className="text-destructive gap-2 hover:bg-destructive/10"
                >
                  <X className="w-5 h-5" />
                  مسح الكل
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Customer & Sale Type */}
          <div className="flex-shrink-0 px-8 py-6 space-y-4">
            <div className="space-y-2">
              <span className="text-base font-medium text-foreground">الزبون</span>
              <CustomerSearchCombobox
                customers={customers}
                value={selectedCustomer}
                onSelect={handleCustomerSelect}
                placeholder="ابحث أو اختر زبون"
              />
            </div>
            {!customerId && (
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="اسم الزبون"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="pr-11 h-11"
                  />
                </div>
                <Input
                  placeholder="رقم الهاتف"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  dir="ltr"
                  className="h-11 text-left"
                />
              </div>
            )}

            <div className="space-y-2">
              <span className="text-base font-medium text-foreground">الضريبة</span>
              <TaxTemplateSelector
                value={taxTemplateId}
                onChange={setTaxTemplateId}
                type="sales"
                placeholder="بدون ضريبة"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant={saleType === "cash" ? "default" : "outline"}
                size="lg"
                className="flex-1 h-12 text-base rounded-xl"
                onClick={() => setSaleType("cash")}
              >
                نقدي
              </Button>
              <Button
                variant={saleType === "credit" ? "default" : "outline"}
                size="lg"
                className="flex-1 h-12 text-base rounded-xl"
                onClick={() => setSaleType("credit")}
              >
                آجل
              </Button>
              <Button
                variant={saleType === "mixed" ? "default" : "outline"}
                size="lg"
                className="flex-1 h-12 text-base rounded-xl"
                onClick={() => setSaleType("mixed")}
              >
                مختلط
              </Button>
            </div>
          </div>

          <Separator className="my-0" />

          {/* Cart Items - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground py-12">
                <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center">
                  <Calculator className="w-12 h-12" />
                </div>
                <span className="text-lg">السلة فارغة</span>
                <span className="text-sm">انقر على المنتجات لإضافتها</span>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.itemId}
                    className="flex items-center gap-4 p-4 bg-muted/40 rounded-xl border border-border/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base truncate">{item.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        ₪ {toMajor(item.pricePerKg)} ×{" "}
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={item.quantityKg}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v >= 0.1) setCartItemQuantity(item.itemId, v);
                          }}
                          className="w-16 h-8 px-2 rounded-lg border border-input bg-background text-center text-sm font-bold inline-block"
                        />{" "}
                        كجم
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-xl"
                        onClick={() => updateQuantity(item.itemId, -0.5)}
                        title="ناقص 0.5 كجم"
                      >
                        <Minus className="w-5 h-5" />
                      </Button>
                      <span className="w-14 text-center font-bold text-base">
                        {Number(item.quantityKg).toFixed(2)}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-xl"
                        onClick={() => updateQuantity(item.itemId, 0.5)}
                        title="زائد 0.5 كجم"
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    </div>
                    <div className="w-24 text-left font-bold text-lg text-primary">
                      ₪ {toMajor(item.total)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10"
                      onClick={() => removeFromCart(item.itemId)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator className="my-0" />

          {/* Totals & Payment - Fixed at bottom */}
          <div className="flex-shrink-0 p-6 space-y-4 bg-gradient-to-t from-muted/50 to-transparent">
            <div className="flex justify-between text-base">
              <span className="text-muted-foreground">المجموع الفرعي</span>
              <span className="font-semibold">₪ {toMajor(subtotalMinor)}</span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-base text-muted-foreground flex-1">الخصم %</span>
              <Input
                type="number"
                value={discount || ""}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-24 h-10 text-center text-base"
                min={0}
                max={100}
              />
              <span className="w-24 text-left text-destructive font-semibold">-₪ {toMajor(discountAmountMinor)}</span>
            </div>

            {taxTemplateId && (
              <>
                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground">صافي (قبل الضريبة)</span>
                  <span className="font-semibold">₪ {toMajor(netTotalMinor)}</span>
                </div>
                {estimatedTaxMinor > 0 && (
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">الضريبة</span>
                    <span className="font-semibold">₪ {toMajor(estimatedTaxMinor)}</span>
                  </div>
                )}
              </>
            )}

            <Separator className="my-2" />

            <div className="flex justify-between items-center py-2">
              <span className="text-xl font-bold">الإجمالي</span>
              <span className="text-3xl font-extrabold text-primary">₪ {toMajor(totalMinor)}</span>
            </div>

            {(saleType === "cash" || saleType === "mixed") && (
              <>
                <div className="flex gap-3">
                  <Button
                    variant={paymentMethod === "cash" ? "default" : "outline"}
                    className="flex-1 gap-2 h-12 text-base rounded-xl"
                    onClick={() => setPaymentMethod("cash")}
                  >
                    <Banknote className="w-5 h-5" />
                    نقداً
                  </Button>
                  <Button
                    variant={paymentMethod === "card" ? "default" : "outline"}
                    className="flex-1 gap-2 h-12 text-base rounded-xl"
                    onClick={() => setPaymentMethod("card")}
                  >
                    <CreditCard className="w-5 h-5" />
                    بطاقة
                  </Button>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-base text-muted-foreground flex-1">المبلغ المدفوع</span>
                  <Input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-32 h-11 text-lg"
                    placeholder="0.00"
                  />
                </div>

                {remainingMinor > 0 && (
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">المتبقي</span>
                    <span className="text-destructive font-bold">₪ {toMajor(remainingMinor)}</span>
                  </div>
                )}
              </>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="gap-2 flex-1 h-12 text-base rounded-xl"
                  disabled={cart.length === 0}
                  onClick={() => setPreviewOpen(true)}
                >
                  <FileText className="w-5 h-5" />
                  معاينة
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 flex-1 h-12 text-base rounded-xl"
                  disabled={cart.length === 0}
                  onClick={handlePrintReceipt}
                >
                  <Printer className="w-5 h-5" />
                  طباعة
                </Button>
              </div>
              <Button
                className="w-full gap-2 h-14 text-lg font-bold rounded-xl shadow-lg"
                size="lg"
                disabled={cart.length === 0 || createSale.isPending}
                onClick={handleCompleteSale}
              >
                {createSale.isPending ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Calculator className="w-6 h-6" />
                )}
                إتمام البيع
              </Button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Preview Invoice Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[400px] p-0 overflow-hidden" dir="rtl">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>معاينة الفاتورة</DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-gray-100 flex justify-center">
            <ThermalReceipt data={receiptData} widthMm={80} className="shadow-lg" />
          </div>
          <div className="flex gap-2 p-4 pt-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handlePrintReceipt}
              disabled={cart.length === 0}
            >
              <Printer className="w-4 h-4" />
              طباعة
            </Button>
            <Button className="flex-1" onClick={() => setPreviewOpen(false)}>
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default POS;
