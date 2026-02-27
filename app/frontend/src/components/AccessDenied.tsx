import { useNavigate } from "react-router-dom";
import { ShieldAlert, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const MESSAGE_AR = "عذرا.. لا يمكن لغير المسؤول الدخول إلى هذه الصفحة";
const MESSAGE_EN = "Access denied. This page is for authorized personnel only.";

/**
 * Reusable screen shown when user lacks permission to access a page.
 * Used by ProtectedRoute for admin-only routes when accountant/non-admin tries to access.
 */
export function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div
      className="flex min-h-[calc(100dvh-6rem)] flex-col items-center justify-center gap-6 rounded-lg border border-border bg-muted/30 p-8"
      role="alert"
      aria-live="polite"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-9 w-9 text-destructive" aria-hidden />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold text-foreground">{MESSAGE_AR}</h1>
        <p className="text-sm text-muted-foreground">{MESSAGE_EN}</p>
      </div>
      <Button onClick={() => navigate("/")} variant="default" className="gap-2">
        <Home className="h-4 w-4" />
        العودة للوحة التحكم
      </Button>
    </div>
  );
}
