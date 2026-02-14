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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useItems } from "@/hooks/use-inventory";
import { useCustomers } from "@/hooks/use-customers";
import { useCreateSale } from "@/hooks/use-sales";
import { TaxTemplateSelector } from "@/components/tax/TaxTemplateSelector";
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

  const { data: itemsResp, isLoading: itemsLoading } = useItems({
    isActive: true,
    page: 1,
    pageSize: 100,
  });
  const { data: customersResp } = useCustomers({ isActive: true, pageSize: 100 });
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

  const addToCart = (item: Item) => {
    const pricePerKg = item.defaultSalePrice ?? 0;
    const quantityKg = 1;
    const total = Math.round(quantityKg * pricePerKg);
    const existing = cart.find((c) => c.itemId === item.id);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.itemId === item.id
            ? {
                ...c,
                quantityKg: c.quantityKg + quantityKg,
                total: Math.round((c.quantityKg + quantityKg) * c.pricePerKg),
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
          quantityKg,
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
          const newKg = Math.max(0, c.quantityKg + delta);
          return {
            ...c,
            quantityKg: newKg,
            total: Math.round(newKg * c.pricePerKg),
          };
        })
        .filter((c) => c.quantityKg > 0)
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
    setDiscount(0);
    setPaidAmount("");
    setTaxTemplateId(null);
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
    <div className="h-[calc(100vh-48px)] flex gap-6" dir="rtl">
      {/* Left Panel - Products */}
      <div className="flex-1 flex flex-col">
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="بحث عن منتج..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Button variant="outline" className="gap-2" disabled>
                <Barcode className="w-4 h-4" />
                مسح
              </Button>
              <Button variant="outline" className="gap-2" disabled>
                <Scale className="w-4 h-4" />
                ميزان
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex-1 overflow-y-auto">
          {itemsLoading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري تحميل المنتجات...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              لا توجد منتجات
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="pos-button bg-card border border-border hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center gap-2 text-center p-4 rounded-lg"
                >
                  <span className="font-semibold text-foreground">{item.name}</span>
                  <span className="text-primary font-bold">
                    ₪ {toMajor(item.defaultSalePrice ?? 0)}/كجم
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <Card className="w-96 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">الفاتورة</CardTitle>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="text-destructive gap-1"
              >
                <X className="w-4 h-4" />
                مسح
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
          {/* Customer & Sale Type */}
          <div className="px-6 pb-4 space-y-3">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">الزبون</span>
              <Select
                value={customerId ? String(customerId) : "walkin"}
                onValueChange={(v) => {
                  if (v === "walkin") {
                    setCustomerId(null);
                    setCustomerName("");
                    setCustomerPhone("");
                  } else {
                    const c = customers.find((x) => x.id === Number(v));
                    if (c) {
                      setCustomerId(c.id);
                      setCustomerName(c.name);
                      setCustomerPhone(c.phone ?? "");
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر زبون" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walkin">زبون عادي</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!customerId && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="اسم الزبون"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </div>
            )}
            {!customerId && (
              <Input
                placeholder="رقم الهاتف"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                dir="ltr"
                className="text-left"
              />
            )}

            {/* Tax Template - Blueprint 05 */}
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">قالب الضريبة</span>
              <TaxTemplateSelector
                value={taxTemplateId}
                onChange={setTaxTemplateId}
                type="sales"
                placeholder="بدون ضريبة"
              />
            </div>

            {/* Sale Type */}
            <div className="flex gap-2 pt-1">
              <Button
                variant={saleType === "cash" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setSaleType("cash")}
              >
                نقدي
              </Button>
              <Button
                variant={saleType === "credit" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setSaleType("credit")}
              >
                آجل
              </Button>
              <Button
                variant={saleType === "mixed" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setSaleType("mixed")}
              >
                مختلط
              </Button>
            </div>
          </div>

          <Separator />

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                لا توجد عناصر في السلة
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.itemId}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ₪ {toMajor(item.pricePerKg)} × {item.quantityKg} كجم
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.itemId, -0.5)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-10 text-center font-semibold text-sm">
                        {item.quantityKg}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.itemId, 0.5)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="w-16 text-left font-semibold">
                      ₪ {toMajor(item.total)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeFromCart(item.itemId)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Totals & Payment */}
          <div className="p-4 space-y-3 bg-muted/30">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المجموع الفرعي</span>
              <span>₪ {toMajor(subtotalMinor)}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground flex-1">الخصم (%)</span>
              <Input
                type="number"
                value={discount || ""}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-20 h-8 text-center"
                min={0}
                max={100}
              />
              <span className="w-20 text-left text-destructive">-₪ {toMajor(discountAmountMinor)}</span>
            </div>

            {taxTemplateId && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">صافي (قبل الضريبة)</span>
                <span>₪ {toMajor(netTotalMinor)}</span>
              </div>
            )}
            {taxTemplateId && estimatedTaxMinor > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الضريبة</span>
                <span>₪ {toMajor(estimatedTaxMinor)}</span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between text-lg font-bold">
              <span>الإجمالي</span>
              <span className="text-primary">₪ {toMajor(totalMinor)}</span>
            </div>

            {(saleType === "cash" || saleType === "mixed") && (
              <>
                <div className="flex gap-2">
                  <Button
                    variant={paymentMethod === "cash" ? "default" : "outline"}
                    className="flex-1 gap-2"
                    size="sm"
                    onClick={() => setPaymentMethod("cash")}
                  >
                    <Banknote className="w-4 h-4" />
                    نقداً
                  </Button>
                  <Button
                    variant={paymentMethod === "card" ? "default" : "outline"}
                    className="flex-1 gap-2"
                    size="sm"
                    onClick={() => setPaymentMethod("card")}
                  >
                    <CreditCard className="w-4 h-4" />
                    بطاقة
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground flex-1">المبلغ المدفوع</span>
                  <Input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-28 h-8"
                    placeholder="0.00"
                  />
                </div>

                {remainingMinor > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">المتبقي</span>
                    <span className="text-destructive font-semibold">₪ {toMajor(remainingMinor)}</span>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="gap-2" size="sm" disabled>
                <Printer className="w-4 h-4" />
                طباعة
              </Button>
              <Button
                className="flex-1 gap-2"
                size="sm"
                disabled={cart.length === 0 || createSale.isPending}
                onClick={handleCompleteSale}
              >
                {createSale.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Calculator className="w-4 h-4" />
                )}
                إتمام البيع
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default POS;
