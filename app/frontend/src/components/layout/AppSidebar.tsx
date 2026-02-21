import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  Users,
  Store,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Menu,
  History,
  FileText,
  CreditCard,
  TrendingUp,
  PieChart,
  Receipt,
  UserCircle,
  Loader2,
  Building2,
  Banknote,
  Shield,
  BookOpen,
  Trash2,
  Scale,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLogout } from "@/hooks/use-auth";
import { useAuth } from "@/context/AuthContext";
import { useRole } from "@/hooks/useRole";
import { ROLE_LABELS, normalizeRole } from "@/constants/roles";

interface NavItem {
  title: string;
  titleAr: string;
  icon: React.ElementType;
  href?: string;
  adminOnly?: boolean;
  children?: {
    title: string;
    titleAr: string;
    href: string;
    icon: React.ElementType;
    adminOnly?: boolean;
  }[];
}

const navigation: NavItem[] = [
  {
    title: "Dashboard",
    titleAr: "لوحة التحكم",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    title: "Inventory",
    titleAr: "المخزون",
    icon: Package,
    href: "/inventory",
  },
  {
    title: "Sales",
    titleAr: "البيع",
    icon: ShoppingCart,
    children: [
      { title: "POS", titleAr: "نقطة البيع", href: "/sales/new", icon: ShoppingCart },
      { title: "Sales History", titleAr: "سجل المبيعات", href: "/sales", icon: History },
    ],
  },
  {
    title: "Purchasing",
    titleAr: "الشراء",
    icon: ShoppingBag,
    href: "/purchasing",
    adminOnly: true,
  },
  {
    title: "Customers",
    titleAr: "الزبائن",
    icon: Users,
    children: [
      { title: "Customer List", titleAr: "قائمة الزبائن", href: "/customers", icon: Users },
      { title: "Credit Accounts", titleAr: "الحسابات", href: "/customers/credits", icon: CreditCard },
    ],
  },
  {
    title: "Suppliers",
    titleAr: "التجار",
    icon: Store,
    adminOnly: true,
    children: [
      { title: "Supplier List", titleAr: "قائمة التجار", href: "/traders", icon: Store },
      { title: "Payables", titleAr: "المستحقات", href: "/traders/payables", icon: Wallet },
    ],
  },
  {
    title: "Payments",
    titleAr: "المدفوعات",
    icon: Banknote,
    children: [
      { title: "Payments List", titleAr: "قائمة المدفوعات", href: "/payments", icon: Banknote },
      { title: "Reconciliation", titleAr: "مطابقة الدفعات", href: "/reconciliation", icon: ArrowLeftRight },
      { title: "Credit Notes", titleAr: "الإشعارات الدائنة", href: "/credit-notes", icon: Receipt },
    ],
  },
  {
    title: "Expenses",
    titleAr: "المصروفات",
    icon: Wallet,
    href: "/expenses",
    adminOnly: true,
  },
  {
    title: "Debts",
    titleAr: "الديون",
    icon: ArrowLeftRight,
    href: "/debts",
    adminOnly: true,
  },
  {
    title: "Wastage",
    titleAr: "الهدر",
    icon: Trash2,
    href: "/wastage",
    adminOnly: true,
  },
  {
    title: "Reports",
    titleAr: "التقارير",
    icon: BarChart3,
    children: [
      { title: "Sales Reports", titleAr: "تقارير المبيعات", href: "/reports/sales", icon: TrendingUp },
      { title: "Inventory Reports", titleAr: "تقارير المخزون", href: "/reports/inventory", icon: Package },
      { title: "Stock vs GL", titleAr: "المخزون مقابل الدفاتر", href: "/reports/stock-vs-gl", icon: Scale, adminOnly: true },
      { title: "Financial Reports", titleAr: "التقارير المالية", href: "/reports/financial", icon: PieChart, adminOnly: true },
      { title: "Tax Reports", titleAr: "تقارير الضرائب", href: "/reports/tax", icon: Receipt, adminOnly: true },
    ],
  },
  {
    title: "Accounting",
    titleAr: "المحاسبة",
    icon: BookOpen,
    children: [
      { title: "Journal Entries", titleAr: "قيود اليومية", href: "/accounting", icon: FileText },
    ],
  },
  {
    title: "Audit",
    titleAr: "سجل المراجعة",
    icon: Shield,
    href: "/audit",
    adminOnly: true,
  },
  {
    title: "Branches",
    titleAr: "الفروع",
    icon: Building2,
    href: "/branches",
    adminOnly: true,
  },
  {
    title: "Settings",
    titleAr: "الإعدادات",
    icon: Settings,
    href: "/settings",
    adminOnly: true,
  },
  {
    title: "Users",
    titleAr: "المستخدمين",
    icon: Users,
    href: "/users",
    adminOnly: true,
  },
];

function getVisibleNavItems(nav: NavItem[], canAccessPath: (path: string) => boolean): NavItem[] {
  return nav.filter((item) => {
    if (item.href) return canAccessPath(item.href);
    if (item.children) return item.children.some((c) => canAccessPath(c.href));
    return false;
  });
}

function getVisibleChildren(item: NavItem, canAccessPath: (path: string) => boolean) {
  if (!item.children) return [];
  return item.children.filter((c) => canAccessPath(c.href));
}

export function AppSidebar() {
  const { user } = useAuth();
  const { canAccessPath } = useRole();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>(["Sales", "Accounting"]);
  const location = useLocation();
  const logoutMutation = useLogout();

  const effectiveRole = normalizeRole(user?.role);
  const visibleNav = getVisibleNavItems(navigation, canAccessPath);

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) =>
      prev.includes(title)
        ? prev.filter((t) => t !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const isGroupActive = (item: NavItem) => {
    if (item.href) return isActive(item.href);
    return item.children?.some((child) => isActive(child.href));
  };

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground sidebar-transition flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Store className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm">نظام إدارة المحل</span>
              <span className="text-xs text-sidebar-muted">Business POS</span>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {visibleNav.map((item) => (
            <li key={item.title}>
              {item.children ? (
                <Collapsible
                  open={!collapsed && openGroups.includes(item.title)}
                  onOpenChange={() => !collapsed && toggleGroup(item.title)}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                        isGroupActive(item)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        collapsed && "justify-center"
                      )}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-right text-sm font-medium">
                            {item.titleAr}
                          </span>
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 transition-transform",
                              openGroups.includes(item.title) && "rotate-180"
                            )}
                          />
                        </>
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="mt-1 mr-4 space-y-1 border-r border-sidebar-border pr-2">
                      {getVisibleChildren(item, canAccessPath).map((child) => (
                        <li key={child.href}>
                          <Link
                            to={child.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                              isActive(child.href)
                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <child.icon className="w-4 h-4" />
                            <span>{child.titleAr}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <Link
                  to={item.href!}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    isActive(item.href!)
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center"
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <span className="text-sm font-medium">{item.titleAr}</span>
                  )}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4">
        {!collapsed && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
              <UserCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{ROLE_LABELS[user?.role || ""] || user?.fullName || "—"}</p>
              <p className="text-xs text-sidebar-muted truncate">{effectiveRole === "admin" ? "Admin" : "Accountant"}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed ? "justify-center px-0" : "justify-start"
          )}
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          {logoutMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <LogOut className="w-5 h-5" />
          )}
          {!collapsed && <span className="mr-3">تسجيل الخروج</span>}
        </Button>
      </div>
    </aside>
  );
}
