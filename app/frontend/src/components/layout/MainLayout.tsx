import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";
import { BackupAutoSyncAgent } from "@/features/backup/components/BackupAutoSyncAgent";

export function MainLayout() {
  const [sidebarCollapsed] = useState(false);

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <BackupAutoSyncAgent />
      <AppSidebar />
      <main
        className={cn(
          "transition-all duration-300 min-h-screen",
          sidebarCollapsed ? "mr-16" : "mr-64"
        )}
      >
        <div className="p-6 max-w-[1600px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
