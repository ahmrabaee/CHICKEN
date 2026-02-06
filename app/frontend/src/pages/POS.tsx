import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Mock products
const products = [
  { id: 1, name: "فروج كامل", price: 22, unit: "كغم", isWeight: true },
  { id: 2, name: "صدور دجاج", price: 35, unit: "كغم", isWeight: true },
  { id: 3, name: "أفخاذ دجاج", price: 28, unit: "كغم", isWeight: true },
  { id: 4, name: "أجنحة دجاج", price: 26, unit: "كغم", isWeight: true },
  { id: 5, name: "دجاج مشوي", price: 25, unit: "قطعة", isWeight: false },
  { id: 6, name: "شيش طاووق", price: 30, unit: "كغم", isWeight: true },
];

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  total: number;
}

export default function POS() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");

  const addToCart = (product: (typeof products)[0]) => {
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          unit: product.unit,
          total: product.price,
        },
      ]);
    }
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.id === id) {
            const newQuantity = Math.max(0, item.quantity + delta);
            return { ...item, quantity: newQuantity, total: newQuantity * item.price };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setDiscount(0);
    setPaidAmount("");
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;
  const paid = parseFloat(paidAmount) || 0;
  const remaining = Math.max(0, total - paid);

  const filteredProducts = products.filter((p) =>
    p.name.includes(searchQuery)
  );

  return (
    <div className="h-[calc(100vh-48px)] flex gap-6">
      {/* Left Panel - Products */}
      <div className="flex-1 flex flex-col">
        {/* Search */}
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
              <Button variant="outline" className="gap-2">
                <Barcode className="w-4 h-4" />
                مسح
              </Button>
              <Button variant="outline" className="gap-2">
                <Scale className="w-4 h-4" />
                ميزان
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="pos-button bg-card border border-border hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center gap-2 text-center p-4"
              >
                <span className="font-semibold text-foreground">{product.name}</span>
                <span className="text-primary font-bold">
                  ₪ {product.price}/{product.unit}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Cart */}
      <Card className="w-96 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">الفاتورة</CardTitle>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} className="text-danger gap-1">
                <X className="w-4 h-4" />
                مسح
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
          {/* Customer Info */}
          <div className="px-6 pb-4 space-y-3">
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
            <Input
              placeholder="رقم الهاتف"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              dir="ltr"
              className="text-left"
            />
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
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ₪ {item.price} × {item.quantity} {item.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="w-16 text-left font-semibold">₪ {item.total}</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-danger"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Totals & Payment */}
          <div className="p-4 space-y-3 bg-muted/30">
            {/* Subtotal */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المجموع الفرعي</span>
              <span>₪ {subtotal.toFixed(2)}</span>
            </div>

            {/* Discount */}
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
              <span className="w-20 text-left text-danger">-₪ {discountAmount.toFixed(2)}</span>
            </div>

            <Separator />

            {/* Total */}
            <div className="flex justify-between text-lg font-bold">
              <span>الإجمالي</span>
              <span className="text-primary">₪ {total.toFixed(2)}</span>
            </div>

            {/* Payment Method */}
            <div className="flex gap-2">
              <Button
                variant={paymentMethod === "cash" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => setPaymentMethod("cash")}
              >
                <Banknote className="w-4 h-4" />
                نقداً
              </Button>
              <Button
                variant={paymentMethod === "card" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => setPaymentMethod("card")}
              >
                <CreditCard className="w-4 h-4" />
                بطاقة
              </Button>
            </div>

            {/* Paid Amount */}
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

            {/* Remaining */}
            {remaining > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المتبقي</span>
                <span className="text-danger font-semibold">₪ {remaining.toFixed(2)}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="gap-2">
                <Printer className="w-4 h-4" />
                طباعة
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={cart.length === 0}
                onClick={() => {
                  // Save sale logic here
                  clearCart();
                }}
              >
                <Calculator className="w-4 h-4" />
                إتمام البيع
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
