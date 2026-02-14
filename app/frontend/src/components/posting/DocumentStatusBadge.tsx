/**
 * Blueprint 03 — Document Status Badge
 * docstatus: 0=Draft, 1=Submitted, 2=Cancelled
 */

import { cn } from "@/lib/utils";

interface DocumentStatusBadgeProps {
    docstatus?: number;
    isVoided?: boolean;
    isApproved?: boolean;
    size?: "sm" | "default";
}

const statusConfig: Record<
    number,
    { label: string; variant: "secondary" | "default" | "destructive" }
> = {
    0: { label: "مسودة", variant: "secondary" },
    1: { label: "مُرحّل", variant: "default" },
    2: { label: "ملغى", variant: "destructive" },
};

export function DocumentStatusBadge({
    docstatus,
    isVoided,
    isApproved,
    size = "default",
}: DocumentStatusBadgeProps) {
    const resolved =
        docstatus !== undefined && docstatus !== null
            ? docstatus
            : isVoided
              ? 2
              : isApproved
                ? 1
                : 0;
    const config = statusConfig[resolved] ?? statusConfig[0];

    const variantClasses = {
        secondary: "bg-muted text-muted-foreground border-border",
        default: "bg-primary/10 text-primary border-primary/20",
        destructive: "bg-destructive/10 text-destructive border-destructive/20",
    };

    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border font-medium",
                variantClasses[config.variant],
                size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
            )}
            dir="rtl"
        >
            {config.label}
        </span>
    );
}
