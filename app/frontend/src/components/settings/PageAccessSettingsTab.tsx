import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Loader2,
  UserCircle,
  ChevronDown,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Wallet,
  BarChart3,
  FileText,
  Settings,
  Check,
  X,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { pageAccessService } from "@/services/page-access.service";
import type { PageAccessItem, AccountantUser } from "@/types/page-access";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const GROUP_META: Record<string, { label: string; icon: React.ElementType }> = {
  _main: { label: "عام", icon: LayoutDashboard },
  inventory: { label: "المخزون", icon: Package },
  sales: { label: "المبيعات", icon: ShoppingCart },
  reports: { label: "التقارير", icon: BarChart3 },
};

export function PageAccessSettingsTab() {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["_main", "inventory", "sales", "reports"]));

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["page-access-users"],
    queryFn: () => pageAccessService.getAccountantUsers(),
  });

  const { data, isLoading: pagesLoading } = useQuery({
    queryKey: ["page-access", selectedUserId],
    queryFn: () => pageAccessService.getByUserId(selectedUserId!),
    enabled: !!selectedUserId,
  });

  const updateMutation = useMutation({
    mutationFn: (dto: { userId: number; pageKey: string; allowed: boolean }) =>
      pageAccessService.update(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page-access", selectedUserId] });
      toast.success("تم تحديث الصلاحيات");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.messageAr || "فشل تحديث الصلاحيات");
    },
  });

  const handleToggle = (page: PageAccessItem, allowed: boolean) => {
    if (!selectedUserId) return;
    updateMutation.mutate({
      userId: selectedUserId,
      pageKey: page.key,
      allowed,
    });
  };

  const groupedPages = useMemo(() => {
    const pages = data?.pages ?? [];
    const filtered = search
      ? pages.filter(
          (p) =>
            p.titleAr.includes(search) || p.path.includes(search) || p.key.includes(search)
        )
      : pages;
    const groups: Record<string, PageAccessItem[]> = {};
    for (const p of filtered) {
      const g = p.groupKey || "_main";
      if (!groups[g]) groups[g] = [];
      groups[g].push(p);
    }
    const order = ["_main", "inventory", "sales", "reports"];
    return order.filter((k) => groups[k]).map((k) => ({ key: k, pages: groups[k] }));
  }, [data?.pages, search]);

  const allowedCount = useMemo(
    () => (data?.pages ?? []).filter((p) => p.allowed).length,
    [data?.pages]
  );

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (!selectedUserId && users[0]) setSelectedUserId(users[0].id);
  }, [users, selectedUserId]);

  if (usersLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <UserCircle className="mb-4 h-16 w-16 text-muted-foreground/50" />
          <p className="text-lg font-medium text-muted-foreground">لا يوجد محاسبون بعد</p>
          <p className="mt-1 text-sm text-muted-foreground">
            أنشئ محاسباً من صفحة المستخدمين ثم عد هنا لتعيين صلاحياته
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-background to-primary/5 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">صلاحيات الصفحات</CardTitle>
              <CardDescription className="mt-0.5">
                تحكم لكل محاسب على حدة — المحاسب X يختلف عن المحاسب Y. يمكن منح أي صفحة لأي محاسب.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCircle className="h-4 w-4" />
              اختر المحاسب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border-2 p-3 text-right transition-all duration-200",
                  selectedUserId === u.id
                    ? "border-primary bg-primary/10 shadow-md"
                    : "border-transparent bg-muted/30 hover:bg-muted/50"
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-lg font-bold text-primary">
                  {u.fullName?.charAt(0) ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                </div>
                {selectedUserId === u.id && (
                  <Check className="h-5 w-5 shrink-0 text-primary" />
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="بحث في الصفحات..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10 text-right"
              />
            </div>
            <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {allowedCount} / {(data?.pages ?? []).length} مفعّل
            </Badge>
          </div>

          {pagesLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {groupedPages.map(({ key, pages: groupPages }) => {
                const meta = GROUP_META[key] ?? { label: key, icon: FileText };
                const Icon = meta.icon;
                const isOpen = openGroups.has(key);
                return (
                  <Collapsible key={key} open={isOpen} onOpenChange={() => toggleGroup(key)}>
                    <Card className="overflow-hidden transition-shadow hover:shadow-md">
                      <CollapsibleTrigger asChild>
                        <button className="flex w-full items-center justify-between p-4 text-right hover:bg-muted/30">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-semibold">{meta.label}</p>
                              <p className="text-sm text-muted-foreground">
                                {groupPages.length} صفحة
                              </p>
                            </div>
                          </div>
                          <ChevronDown
                            className={cn("h-5 w-5 transition-transform", isOpen && "rotate-180")}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t bg-muted/20">
                          {groupPages.map((page, i) => (
                            <div
                              key={page.id}
                              className={cn(
                                "flex items-center justify-between gap-4 border-b p-4 last:border-b-0",
                                "transition-colors",
                                page.allowed
                                  ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                                  : "hover:bg-muted/30"
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium">{page.titleAr}</p>
                                <p className="text-xs text-muted-foreground font-mono">{page.path}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "text-xs font-medium",
                                    page.allowed ? "text-emerald-600" : "text-muted-foreground"
                                  )}
                                >
                                  {page.allowed ? "مُتاح" : "مغلق"}
                                </span>
                                <Switch
                                  checked={page.allowed}
                                  onCheckedChange={(v) => handleToggle(page, v)}
                                  disabled={updateMutation.isPending}
                                  className="data-[state=checked]:bg-emerald-600"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
