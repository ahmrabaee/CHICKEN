import { cn } from "@/lib/utils";

type StatusType = "success" | "warning" | "danger" | "info" | "default";

interface StatusBadgeProps {
  status: StatusType;
  children: React.ReactNode;
  size?: "sm" | "md";
}

const statusStyles: Record<StatusType, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-danger/10 text-danger border-danger/20",
  info: "bg-info/10 text-info border-info/20",
  default: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status, children, size = "sm" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        statusStyles[status],
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
    >
      {children}
    </span>
  );
}

// Payment status helper
export function PaymentStatusBadge({ status }: { status: "Paid" | "PartiallyPaid" | "Unpaid" }) {
  const statusMap: Record<string, { type: StatusType; label: string }> = {
    Paid: { type: "success", label: "مدفوع" },
    PartiallyPaid: { type: "warning", label: "مدفوع جزئياً" },
    Unpaid: { type: "danger", label: "غير مدفوع" },
  };

  const { type, label } = statusMap[status];
  return <StatusBadge status={type}>{label}</StatusBadge>;
}

// Stock status helper
export function StockStatusBadge({ current, min }: { current: number; min: number }) {
  if (current === 0) {
    return <StatusBadge status="danger">نفذ</StatusBadge>;
  }
  if (current <= min) {
    return <StatusBadge status="warning">منخفض</StatusBadge>;
  }
  return <StatusBadge status="success">متوفر</StatusBadge>;
}
