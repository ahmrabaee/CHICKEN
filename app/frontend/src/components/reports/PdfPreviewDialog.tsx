import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Download, Loader2, FileWarning, ZoomIn, ZoomOut, RotateCcw, RefreshCw } from 'lucide-react';
import { usePdfDownload } from '@/hooks/use-pdf-download';

type PdfParams = {
  language?: 'en' | 'ar';
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  branchId?: string;
  id?: number;
  accountCode?: string;
};

const REPORT_NEEDS_DATE_RANGE = [
  'sales-report',
  'purchases-report',
  'expenses-report',
  'receivables-report',
  'payables-report',
  'income-statement',
  'ledger',
  'supplier-statement',
  'customer-statement',
];
const REPORT_NEEDS_AS_OF_DATE = ['balance-sheet', 'trial-balance', 'inventory-report'];

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportType: string;
  params: PdfParams;
  title: string;
  showFilters?: boolean;
}

function getDefaultDates() {
  const n = new Date();
  const start = new Date(n.getFullYear(), n.getMonth(), 1);
  const end = new Date(n.getFullYear(), n.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    asOfDate: n.toISOString().slice(0, 10),
  };
}

export function PdfPreviewDialog({
  open,
  onOpenChange,
  reportType,
  params,
  title,
  showFilters = true,
}: PdfPreviewDialogProps) {
  const defaults = getDefaultDates();
  const [language, setLanguage] = useState<'ar' | 'en'>(params.language || 'ar');
  const [startDate, setStartDate] = useState(params.startDate || defaults.startDate);
  const [endDate, setEndDate] = useState(params.endDate || defaults.endDate);
  const [asOfDate, setAsOfDate] = useState(params.asOfDate || defaults.asOfDate);
  const [zoom, setZoom] = useState(100);

  const needsDateRange = REPORT_NEEDS_DATE_RANGE.includes(reportType);
  const needsAsOfDate = REPORT_NEEDS_AS_OF_DATE.includes(reportType);

  const mergedParams: PdfParams = {
    ...params,
    language,
    ...(needsDateRange && { startDate, endDate }),
    ...(needsAsOfDate && { asOfDate }),
  };

  const {
    fetchAndPreview,
    download,
    clearPreview,
    previewUrl,
    isLoading,
    error,
  } = usePdfDownload();

  useEffect(() => {
    if (!open) {
      clearPreview();
      return;
    }
    if (reportType) {
      fetchAndPreview(reportType, mergedParams);
    }
  }, [open]);

  useEffect(() => {
    if (open && reportType) {
      setLanguage(params.language || 'ar');
      setStartDate(params.startDate || defaults.startDate);
      setEndDate(params.endDate || defaults.endDate);
      setAsOfDate(params.asOfDate || defaults.asOfDate);
    }
  }, [open, reportType]);

  const handleRefresh = () => {
    if (reportType) fetchAndPreview(reportType, mergedParams);
  };

  const handleDownload = () => {
    download(reportType, mergedParams);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90dvh] flex flex-col gap-0 p-0 overflow-hidden"
        dir="rtl"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="text-xl font-bold text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            معاينة وتحميل التقرير بصيغة PDF
          </DialogDescription>
        </DialogHeader>

        {showFilters && (needsDateRange || needsAsOfDate || true) && (
          <div className="px-6 py-3 border-b bg-muted/10 flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">اللغة</Label>
              <Select value={language} onValueChange={(v: 'ar' | 'en') => setLanguage(v)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {needsDateRange && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">من تاريخ</Label>
                  <DatePicker
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="من تاريخ"
                    className="w-36"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">إلى تاريخ</Label>
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="إلى تاريخ"
                    className="w-36"
                  />
                </div>
              </>
            )}
            {needsAsOfDate && !needsDateRange && (
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">تاريخ الجرد</Label>
                <DatePicker
                  value={asOfDate}
                  onChange={setAsOfDate}
                  placeholder="تاريخ الجرد"
                  className="w-36"
                />
              </div>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4" />
              تحديث
            </Button>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col p-6 gap-4">
          {isLoading ? (
            <div className="flex-1 min-h-[400px] flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium">جاري تحميل التقرير...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 min-h-[400px] flex items-center justify-center rounded-lg border-2 border-dashed border-destructive/30 bg-destructive/5 p-6">
              <div className="flex flex-col items-center gap-4 text-center max-w-md">
                <FileWarning className="w-12 h-12 text-destructive" />
                <p className="text-destructive font-medium">{error}</p>
                <p className="text-sm text-muted-foreground">
                  جرّب: (1) تسجيل الخروج وإعادة الدخول (2) تعطيل IDM لـ localhost (3) تشغيل التطبيق من المتصفح على localhost:5173
                </p>
              </div>
            </div>
          ) : previewUrl ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">التكبير</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setZoom((z) => Math.min(150, z + 10))}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setZoom((z) => Math.max(50, z - 10))}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setZoom(100)}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[3rem]">{zoom}%</span>
                </div>
              </div>
              <div
                className="rounded-lg border bg-muted/10 shadow-inner overflow-auto"
                style={{ minHeight: 450, maxHeight: '60dvh' }}
              >
                <div
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top right',
                    width: '100%',
                    minHeight: 450,
                  }}
                >
                  <iframe
                    src={previewUrl}
                    title={title}
                    className="w-full border-0"
                    style={{ minHeight: 450, display: 'block' }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 flex-row gap-2 justify-start">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
            إغلاق
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isLoading || !!error || !previewUrl}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <Download className="w-4 h-4" />
            تحميل PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
