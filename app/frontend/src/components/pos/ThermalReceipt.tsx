/**
 * Thermal Receipt Component
 * Designed for 58mm (~200px) or 80mm (~302px) thermal printers.
 * Use with window.print() and @media print.
 */
function toMajor(units: number): string {
  return (units / 100).toFixed(2);
}

export interface ThermalReceiptItem {
  name: string;
  quantityKg: number;
  pricePerKg: number;
  total: number;
}

export interface ThermalReceiptData {
  storeName?: string;
  logoUrl?: string;
  taxNumber?: string;
  header?: string;
  footer?: string;
  customerName?: string;
  customerPhone?: string;
  items: ThermalReceiptItem[];
  subtotal: number;
  discountAmount?: number;
  taxAmount?: number;
  grandTotal: number;
  paidAmount?: number;
  remainingAmount?: number;
  saleType?: "cash" | "credit";
  date?: string;
}

interface ThermalReceiptProps {
  data: ThermalReceiptData;
  widthMm?: 58 | 80;
  className?: string;
}

export function ThermalReceipt({ data, widthMm = 80, className = "" }: ThermalReceiptProps) {
  const widthPx = widthMm === 58 ? 200 : 302;

  return (
    <div
      className={`thermal-receipt bg-white text-black font-mono text-xs ${className}`}
      style={{
        width: widthPx,
        maxWidth: widthPx,
        padding: 8,
        fontSize: 11,
        fontFamily: "monospace",
      }}
    >
      <div className="text-center border-b border-black border-dashed pb-2 mb-2">
        {data.logoUrl && (
          <img src={data.logoUrl} alt="" className="mx-auto h-14 w-14 object-contain mb-1" />
        )}
        {data.storeName && <div className="font-bold text-sm">{data.storeName}</div>}
        {data.header && <div className="text-[10px] mt-1">{data.header}</div>}
        {data.taxNumber && <div className="text-[10px]">{data.taxNumber}</div>}
      </div>

      <div className="border-b border-black border-dashed pb-2 mb-2 space-y-0.5">
        <div>التاريخ: {data.date ?? new Date().toLocaleString("en-US")}</div>
        {data.customerName && <div>الزبون: {data.customerName}</div>}
        {data.customerPhone && <div>الهاتف: {data.customerPhone}</div>}
      </div>

      <div className="border-b border-black border-dashed py-2 mb-2">
        <div className="flex justify-between text-[10px] mb-1 font-semibold">
          <span>الصنف</span>
          <span>كم</span>
          <span>سعر</span>
          <span>الإجمالي</span>
        </div>
        {data.items.map((item, i) => (
          <div key={i} className="flex justify-between text-[10px] py-0.5 border-b border-dashed border-gray-300">
            <span className="flex-1 truncate max-w-[80px]">{item.name}</span>
            <span className="w-8 text-center">{item.quantityKg.toFixed(2)}</span>
            <span className="w-10 text-left">{toMajor(item.pricePerKg)}</span>
            <span className="w-12 text-left font-medium">{toMajor(item.total)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-0.5 py-2 border-b border-black border-dashed">
        <div className="flex justify-between">
          <span>المجموع الفرعي</span>
          <span>{toMajor(data.subtotal)}</span>
        </div>
        {data.discountAmount !== undefined && data.discountAmount > 0 && (
          <div className="flex justify-between">
            <span>الخصم</span>
            <span>-{toMajor(data.discountAmount)}</span>
          </div>
        )}
        {data.taxAmount !== undefined && data.taxAmount > 0 && (
          <div className="flex justify-between">
            <span>الضريبة</span>
            <span>{toMajor(data.taxAmount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm pt-1">
          <span>الإجمالي</span>
          <span>₪ {toMajor(data.grandTotal)}</span>
        </div>
        {data.paidAmount !== undefined && data.paidAmount > 0 && (
          <div className="flex justify-between">
            <span>المدفوع</span>
            <span>₪ {toMajor(data.paidAmount)}</span>
          </div>
        )}
        {data.remainingAmount !== undefined && data.remainingAmount > 0 && (
          <div className="flex justify-between font-semibold">
            <span>المتبقي</span>
            <span>₪ {toMajor(data.remainingAmount)}</span>
          </div>
        )}
      </div>

      <div className="text-center py-2 mt-2">
        {data.footer && <div className="text-[10px] mb-1">{data.footer}</div>}
        <div className="font-bold">شكراً لكم</div>
        <div className="text-[10px]">Thank you</div>
      </div>
    </div>
  );
}
