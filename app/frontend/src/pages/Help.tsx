import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Trash2, ShoppingBag, Users, Store,
  Banknote, Wallet, ArrowLeftRight, BarChart3, BookOpen, Shield, UserCircle,
  Building2, Settings, Search, HelpCircle, Lightbulb, CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { USER_GUIDE, GuideSection } from '@/constants/userGuide';

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, ShoppingCart, Package, Trash2, ShoppingBag, Users, Store,
  Banknote, Wallet, ArrowLeftRight, BarChart3, BookOpen, Shield, UserCircle,
  Building2, Settings,
};

function matches(section: GuideSection, q: string): boolean {
  if (!q) return true;
  const hay = [section.title, section.intro, ...section.steps, ...(section.tips ?? [])]
    .join(' ')
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

export default function Help() {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>(USER_GUIDE[0]?.id ?? '');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const visible = useMemo(() => USER_GUIDE.filter((s) => matches(s, query)), [query]);

  // Scroll to the section named in the URL hash (contextual help: /help#pos)
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && sectionRefs.current[hash]) {
      sectionRefs.current[hash]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActive(hash);
    }
  }, [location.hash]);

  const scrollTo = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HelpCircle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">دليل المستخدم</h1>
          <p className="text-sm text-muted-foreground">شرح مبسّط لكل قسم في النظام خطوة بخطوة.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ابحث في الدليل..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pr-9"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* Section nav */}
        <nav className="hidden lg:block">
          <div className="sticky top-6 space-y-1">
            {visible.map((s) => {
              const Icon = ICONS[s.icon] ?? HelpCircle;
              return (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm transition-colors ${
                    active === s.id
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{s.title}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="space-y-5">
          {visible.length === 0 && (
            <p className="text-center text-muted-foreground">لا توجد نتائج مطابقة لبحثك.</p>
          )}
          {visible.map((s) => {
            const Icon = ICONS[s.icon] ?? HelpCircle;
            return (
              <div
                key={s.id}
                id={s.id}
                ref={(el) => (sectionRefs.current[s.id] = el)}
                className="scroll-mt-6"
              >
                <Card className="overflow-hidden border-border/60">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="text-lg font-bold">{s.title}</h2>
                    </div>
                    <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{s.intro}</p>

                    <ol className="space-y-2">
                      {s.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>

                    {s.tips && s.tips.length > 0 && (
                      <div className="mt-4 rounded-lg bg-amber-500/10 p-3">
                        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                          <Lightbulb className="h-4 w-4" />
                          نصائح
                        </div>
                        <ul className="space-y-1">
                          {s.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
