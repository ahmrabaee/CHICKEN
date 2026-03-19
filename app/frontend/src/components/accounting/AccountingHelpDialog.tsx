/**
 * دليل المستخدم لصفحة المحاسبة — نافذة مساعدة RTL تفصيلية
 */
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface AccountingHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 text-right" dir="rtl">
      <h3 className="text-base font-bold text-foreground border-b border-slate-200 dark:border-slate-700 pb-1">{title}</h3>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2 text-right">{children}</div>
    </div>
  );
}

function Step({ n, text }: { n: number; text: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-right" dir="rtl">
      <span className="font-bold text-primary shrink-0">{n}.</span>
      <span className="flex-1">{text}</span>
    </div>
  );
}

function HelpTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 my-2" dir="rtl">
      <table className="w-full text-sm text-right" dir="rtl">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-right p-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-200 dark:border-slate-700">
              {r.map((c, j) => (
                <td key={j} className="p-3 text-right">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AccountingHelpDialog({ open, onOpenChange }: AccountingHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90dvh] p-0 [&>button]:right-auto [&>button]:left-4"
        dir="rtl"
      >
        <DialogHeader className="p-6 pb-2 text-right">
          <DialogTitle className="text-xl font-bold">دليل المستخدم — صفحة المحاسبة</DialogTitle>
          <p className="text-sm text-muted-foreground">دليل تفصيلي لاستخدام كل وظيفة في نظام المحاسبة</p>
        </DialogHeader>
        <ScrollArea className="h-[calc(90dvh-120px)] px-6" dir="rtl">
          <div className="space-y-6 pb-6 text-right" dir="rtl">

            <Section title="نظرة عامة">
              <p>صفحة المحاسبة تحتوي على ثلاثة تبويبات رئيسية:</p>
              <HelpTable
                headers={["التبويب", "الوظيفة"]}
                rows={[
                  ["دليل الحسابات", "عرض وإنشاء وتعديل الحسابات المحاسبية"],
                  ["قيود اليومية", "عرض وإنشاء القيود المحاسبية (المدين والدائن)"],
                  ["ميزان المراجعة", "عرض أرصدة جميع الحسابات للتأكد من التوازن"],
                ]}
              />
              <p>في أعلى الصفحة توجد أزرار لتحميل أو طباعة التقارير PDF.</p>
            </Section>

            <Separator />

            <Section title="دليل الحسابات">
              <p><strong>البحث:</strong> اكتب كود أو اسم الحساب في شريط البحث.</p>
              <p><strong>فتح/إغلاق الكل:</strong> لفتح أو طي جميع المستويات الهرمية.</p>
              <p><strong>إضافة حساب:</strong> انقر «إضافة حساب» واملأ:</p>
              <ul className="list-disc list-inside pr-6 space-y-1 text-right">
                <li>كود الحساب (لا يُغيّر لاحقاً)</li>
                <li>اسم الحساب</li>
                <li>نوع الحساب (بنك، نقد، ذمم مدينة، مصروف، إيراد، إلخ)</li>
                <li>الحساب الأب (للتسلسل الهرمي)</li>
                <li>حساب مجموعة: للتجميع فقط، لا يُستخدم في القيود</li>
              </ul>
              <p><strong>عرض دفتر الأستاذ:</strong> من تفاصيل الحساب انقر «دفتر الأستاذ» لعرض القيود والرصيد.</p>
            </Section>

            <Separator />

            <Section title="كيفية إنشاء حسابات بنكية (بالتفصيل الممل)">
              <p className="font-semibold text-foreground">الطريقة الأولى — الأسهل (من الإعدادات):</p>
              <div className="space-y-1">
                <Step n={1} text="اذهب إلى الإعدادات من القائمة الجانبية" />
                <Step n={2} text="اختر تبويب «الحسابات البنكية»" />
                <Step n={3} text="انقر «إضافة حساب بنكي»" />
                <Step n={4} text={
                  <>في النافذة: <strong>الاسم</strong> (مثل بنك فلسطين)، و<strong>الحساب في دليل الحسابات</strong> اختر «إنشاء حساب جديد تحت النقد في البنك (1112)»</>
                } />
                <Step n={5} text="فعّل «افتراضي للتحويلات البنكية» إن أردت" />
                <Step n={6} text="انقر «إضافة» — النظام ينشئ الحساب المحاسبي تلقائياً تحت 1112" />
              </div>
              <p className="text-amber-600 dark:text-amber-500 font-medium mt-2">بعد ذلك يظهر البنك في قوائم «الحساب البنكي» عند الدفع بالتحويل البنكي أو البطاقة.</p>

              <p className="font-semibold text-foreground mt-4">الطريقة الثانية — اليدوية (من المحاسبة ثم الإعدادات):</p>
              <div className="space-y-1">
                <Step n={1} text="المحاسبة → دليل الحسابات → إضافة حساب" />
                <Step n={2} text="كود: 1112-002، اسم: بنك الأقصى، نوع: بنك، الأب: 1112 النقد في البنك" />
                <Step n={3} text="انقر إنشاء" />
                <Step n={4} text="اذهب إلى الإعدادات → الحسابات البنكية → إضافة حساب بنكي" />
                <Step n={5} text="اختر الحساب الذي أنشأته من القائمة، ثم إضافة" />
              </div>

              <p className="mt-2">لتعديل أو حذف: من <Link to="/settings" className="underline text-primary" onClick={() => onOpenChange(false)}>الإعدادات → الحسابات البنكية</Link>.</p>
            </Section>

            <Separator />

            <Section title="قيود اليومية">
              <p><strong>أنواع القيود:</strong> قبض (أخضر)، دفع (أزرق)، مصروفات (كهرماني)، معكوس/عكسي (كهرماني فاتح).</p>
              <p><strong>إضافة قيد:</strong> انقر «إضافة قيد» → املأ التاريخ والوصف والأسطر (حساب + مدين أو دائن). يجب أن يتساوى إجمالي المدين مع إجمالي الدائن.</p>
              <p><strong>ترحيل:</strong> القيد يُنشأ كمسودة؛ من تفاصيل القيد انقر «ترحيل القيد» ليُحتسب في التقارير. بعد الترحيل لا يُعدّل يدوياً.</p>
            </Section>

            <Separator />

            <Section title="ميزان المراجعة">
              <p>يعرض أرصدة جميع الحسابات (مدين/دائن). في المحاسبة المزدوجة إجمالي المدين = إجمالي الدائن. إذا ظهرت رسالة «غير متوازن» فهناك خطأ في أحد القيود.</p>
            </Section>

            <Separator />

            <Section title="التقارير PDF">
              <p>قائمة المركز المالي، قائمة الدخل، ميزان المراجعة — مع أزرار تحميل وطباعة في أعلى الصفحة.</p>
            </Section>

            <Separator />

            <Section title="ربط المحاسبة بالمدفوعات">
              <p>عند الدفع بالتحويل البنكي أو البطاقة في المشتريات أو المدفوعات، يجب اختيار «الحساب البنكي». إذا لم تضف حسابات بنكية من الإعدادات لن تظهر القائمة.</p>
            </Section>

            <p className="text-xs text-muted-foreground pt-4">دليل مفصل: docs/ACCOUNTING_USER_GUIDE_AR.md — تاريخ التحديث: 2026-03-19</p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
