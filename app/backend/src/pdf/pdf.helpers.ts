import { Content, DynamicContent } from 'pdfmake/interfaces';
import { PdfMeta } from './pdf.types';
import { PDF_DESIGN } from './pdf.constants';

/** inline=1 يتجنّب اعتراض IDM على التحميل */
export function getPdfContentDisposition(filename: string, inline?: string): string {
    const disp = (inline === '1' || inline === 'true') ? 'inline' : 'attachment';
    return `${disp}; filename="${filename}"`;
}

export function formatCurrency(amount: number | string): string {
    const minorUnits = Number(amount);
    if (!Number.isFinite(minorUnits)) return '0.00';
    return (minorUnits / 100).toFixed(2);
}

/** Format amount with currency symbol for financial reports (e.g. "84.00 ₪") — symbol may not render in all fonts */
export function formatCurrencyWithSymbol(amount: number | string): string {
    const formatted = formatCurrency(amount);
    return `${formatted} ₪`;
}

// ========== SAFE FORMATTERS — never allow NaN, undefined, null in PDF ==========
const FALLBACK_DATE_AR = 'غير محدد';
const FALLBACK_DATE_EN = 'Not specified';

/** Parse date safely; prefer ISO YYYY-MM-DD or DD-MM-YYYY. Returns DD-MM-YYYY or fallback. */
export function formatDateSafe(value: string | Date | undefined | null, fallback?: string, lang: 'ar' | 'en' = 'ar'): string {
    const fb = fallback ?? (lang === 'ar' ? FALLBACK_DATE_AR : FALLBACK_DATE_EN);
    if (value == null) return fb;
    const str = typeof value === 'string' ? value.trim() : '';
    if (typeof value === 'string' && !str) return fb;
    let d: Date;
    // Prefer ISO YYYY-MM-DD (parses reliably)
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(str)) {
        d = new Date(str.substring(0, 10));
    } else if (typeof value === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(str)) {
        // DD-MM-YYYY — avoid Invalid Date from new Date('18-03-2026')
        const [dayStr, monthStr, yearStr] = str.split('-');
        const day = parseInt(dayStr!, 10);
        const month = parseInt(monthStr!, 10) - 1;
        const year = parseInt(yearStr!, 10);
        if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year > 0) {
            d = new Date(year, month, day);
            if (d.getDate() === day && d.getMonth() === month && d.getFullYear() === year) {
                return str; // already valid DD-MM-YYYY
            }
        }
        d = new Date(NaN);
    } else {
        d = value instanceof Date ? value : new Date(value as string);
    }
    const ts = d.getTime();
    if (!Number.isFinite(ts)) return fb;
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return fb;
    return `${String(day).padStart(2, '0')}-${String(month + 1).padStart(2, '0')}-${year}`;
}

/** Format number safely; never NaN. Default 0 if invalid. */
export function formatNumberSafe(value: number | string | undefined | null, defaultVal = 0): string {
    const n = value == null ? defaultVal : Number(value);
    if (!Number.isFinite(n)) return String(defaultVal);
    return String(n);
}

/** Format currency (minor units → major) safely; never NaN. Default "0.00". */
export function formatCurrencySafe(amount: number | string | undefined | null): string {
    return formatCurrency(amount ?? 0);
}

/** Amount only for table cells — no symbol (avoids font glyph issues with ₪). */
export function formatCurrencyDisplay(amount: number | string | undefined | null): string {
    return formatCurrencySafe(amount);
}

/** Currency label for reports: "شيكل (₪)" in Arabic, "ILS (₪)" in English. */
export function getCurrencyReportLabel(lang: 'ar' | 'en', custom?: string): string {
    if (custom) return custom;
    return lang === 'ar' ? 'شيكل (₪)' : 'ILS (₪)';
}

/** Format ISO timestamp for footer: "DD-MM-YYYY HH:mm" or fallback. */
export function formatDateTimeSafe(value: string | Date | undefined | null, fallback = ''): string {
    if (value == null) return fallback;
    const d = typeof value === 'string' ? new Date(value) : value;
    if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return fallback;
    const date = formatDateSafe(value, fallback, 'en');
    if (date === FALLBACK_DATE_EN || date === FALLBACK_DATE_AR) return fallback;
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${date} ${h}:${m}`;
}

export function formatWeight(amount: number | string): string {
    return Number(amount).toFixed(3) + ' kg';
}

export function formatDate(date: string | Date | undefined, lang: 'en' | 'ar'): string {
    if (!date) return '';
    try {
        return new Date(date).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US');
    } catch (e) {
        return String(date);
    }
}

/** Date for header: DD-MM-YYYY with Western numerals — avoids Arabic numeral rendering issues. Prefer formatDateSafe for critical reports. */
export function formatDateForHeader(date: string | Date | undefined): string {
    const s = formatDateSafe(date, undefined, 'en');
    return s === FALLBACK_DATE_EN ? '' : s;
}

/** Build rich header with app data, store info, and report title - RTL aware */
export function buildHeader(meta: PdfMeta, logoBase64: string | null): Content {
    const isArabic = meta.language === 'ar';
    const appName = isArabic ? (meta.appName || 'برنامج الإدارة المالية') : (meta.appNameEn || 'Financial Management Program');
    const appVersion = meta.appVersion ? ` v${meta.appVersion}` : '';
    const storeDisplay = isArabic ? meta.storeName : (meta.storeNameEn || meta.storeName);
    const titleText = isArabic && meta.titleAr ? meta.titleAr : meta.title;

    // Contact line (address, phone, email - only show if we have at least one)
    const contactParts: string[] = [];
    if (meta.address) contactParts.push(meta.address);
    if (meta.phone) contactParts.push(meta.phone);
    if (meta.email) contactParts.push(meta.email);
    if (meta.website) contactParts.push(meta.website);
    const contactLine = contactParts.join(' | ');

    const dateLabel = isArabic ? 'التاريخ: ' : 'Date: ';
    const taxLabel = isArabic ? 'الرقم الضريبي: ' : 'Tax No: ';

    // RTL: In Arabic, columns order: [Logo right] [Center content] [Date left]
    // LTR: In English, columns order: [Logo left] [Center content] [Date right]
    const logoCol = logoBase64 ? {
        image: logoBase64,
        width: PDF_DESIGN.header.logoWidth,
        height: PDF_DESIGN.header.logoHeight,
        margin: (isArabic ? [0, 0, 0, 0] : [0, 0, 10, 0]) as [number, number, number, number],
    } : { text: '', width: 0 };

    const centerCol = {
        stack: [
            // App name (keep separate from version to avoid RTL/LTR bidi reorder issues)
            {
                text: appName,
                fontSize: PDF_DESIGN.fonts.sizes.appName,
                bold: true,
                color: PDF_DESIGN.colors.primary,
                alignment: 'center',
            },
            // Version on separate line (LTR numbers avoid bidi confusion)
            appVersion ? {
                text: appVersion.trim(),
                fontSize: PDF_DESIGN.fonts.sizes.small,
                color: PDF_DESIGN.colors.textMuted,
                alignment: 'center',
                margin: [0, 2, 0, 0],
            } : { text: '' },
            // Store name (skip if same as app name)
            (storeDisplay && storeDisplay !== appName) ? {
                text: storeDisplay,
                fontSize: PDF_DESIGN.fonts.sizes.storeName,
                color: PDF_DESIGN.colors.secondary,
                alignment: 'center',
                margin: [0, 2, 0, 0],
            } : { text: '' },
            // Tax number (if exists)
            meta.taxNumber ? {
                text: [{ text: taxLabel, color: PDF_DESIGN.colors.textMuted }, meta.taxNumber],
                fontSize: PDF_DESIGN.fonts.sizes.small,
                alignment: 'center',
                margin: [0, 2, 0, 0],
            } : { text: '' },
            // Contact line (if exists)
            contactLine ? {
                text: contactLine,
                fontSize: PDF_DESIGN.fonts.sizes.small,
                color: PDF_DESIGN.colors.textMuted,
                alignment: 'center',
                margin: [0, 4, 0, 0],
            } : { text: '' },
            // Divider line
            {
                canvas: [{
                    type: 'line',
                    x1: 0,
                    y1: 0,
                    x2: 350,
                    y2: 0,
                    lineWidth: PDF_DESIGN.header.dividerHeight,
                    lineColor: PDF_DESIGN.colors.primary,
                }],
                margin: [0, 8, 0, 0],
            },
            // Report title
            {
                text: titleText,
                style: 'header',
                margin: [0, 10, 0, 0],
            },
            // Subtitle (period) - e.g. 2026-01-31 — 2026-02-27
            (meta.subtitle || meta.subtitleAr) ? {
                text: isArabic && meta.subtitleAr ? meta.subtitleAr : meta.subtitle,
                style: 'subtitle',
                margin: [0, 2, 0, 0],
            } : { text: '' },
        ],
        width: '*',
    };

    const dateStr = formatDateForHeader(meta.generatedAt);
    const dateCol = {
        text: [
            { text: dateLabel, color: PDF_DESIGN.colors.textMuted },
            dateStr,
        ],
        fontSize: PDF_DESIGN.fonts.sizes.small,
        alignment: isArabic ? 'right' : 'left',
        width: 'auto',
    };

    // RTL: put logo on RIGHT, date on LEFT. LTR: logo LEFT, date RIGHT
    const columns = isArabic
        ? [dateCol, centerCol, logoCol]   // RTL order
        : [logoCol, centerCol, dateCol];  // LTR order

    return {
        columns,
        margin: [0, 15, 0, 0],
    } as Content;
}

export function buildFooter(meta: PdfMeta, logoBase64: string | null): (currentPage: number, pageCount: number) => any {
    const isArabic = meta.language === 'ar';
    const appName = isArabic ? (meta.appName || 'برنامج الإدارة المالية') : (meta.appNameEn || 'Financial Management Program');

    const logoCol = logoBase64 ? {
        image: logoBase64,
        width: PDF_DESIGN.footer.logoWidth,
        height: PDF_DESIGN.footer.logoHeight,
        margin: (isArabic ? [0, 0, 0, 0] : [40, 0, 5, 0]) as [number, number, number, number],
    } : { text: '', width: 0 };

    const centerCol = {
        stack: [
            {
                text: appName,
                fontSize: PDF_DESIGN.footer.appNameSize,
                color: PDF_DESIGN.colors.textMuted,
                bold: true,
            },
            {
                text: (currentPage: number, pageCount: number) => `${currentPage} / ${pageCount}`,
                fontSize: PDF_DESIGN.footer.pageNumberSize,
                color: PDF_DESIGN.colors.textMuted,
            } as any,
        ],
        alignment: 'center',
        width: '*',
        margin: [0, 3, 0, 0],
    };

    // pdfmake footer receives (currentPage, pageCount) - we need to handle that for page number
    return (currentPage: number, pageCount: number) => ({
        columns: [
            logoCol,
            {
                ...centerCol,
                stack: [
                    (centerCol as any).stack[0],
                    {
                        text: `${currentPage} / ${pageCount}`,
                        fontSize: PDF_DESIGN.footer.pageNumberSize,
                        color: PDF_DESIGN.colors.textMuted,
                    },
                ],
            },
            {
                text: meta.storeName || '',
                fontSize: PDF_DESIGN.footer.appNameSize,
                color: PDF_DESIGN.colors.textMuted,
                alignment: (isArabic ? 'left' : 'right') as 'left' | 'right',
                width: 'auto',
                margin: (isArabic ? [40, 5, 0, 0] : [0, 5, 40, 0]) as [number, number, number, number],
            },
        ],
        margin: [0, 10, 0, 0],
    });
}

export interface FinancialReportHeaderData {
    companyName: string;
    reportTitle: string;
    reportTitleAr: string;
    dateLabel?: string;
    dateLabelAr?: string;
    dateValue?: string; // e.g. "As of date" or "Period"
    dateValueAr?: string;
    asOfDateRaw?: string;
    asOfDate?: string;
    language: 'en' | 'ar';
    generatedAt?: string;
    generatedBy?: string;
    currency?: string;
    branchName?: string;
}

/** Legacy alias */
export type BalanceSheetHeaderData = FinancialReportHeaderData;

/** Professional financial report header — company, title, date, extraction metadata. RTL aware. */
export function buildFinancialReportHeader(data: FinancialReportHeaderData, logoBase64: string | null): Content {
    const isArabic = data.language === 'ar';
    const title = isArabic ? data.reportTitleAr : data.reportTitle;
    const currencyLabel = data.currency || (isArabic ? 'شيكل' : 'ILS');
    const dateLabelStr = isArabic ? (data.dateLabelAr || 'التاريخ: ') : (data.dateLabel || 'Date: ');
    const dateValueStr = isArabic ? (data.dateValueAr || data.dateValue || '') : (data.dateValue || '');

    const logoCol = logoBase64 ? {
        image: logoBase64,
        width: 42,
        height: 42,
        margin: (isArabic ? [0, 0, 12, 0] : [12, 0, 0, 0]) as [number, number, number, number],
    } : { text: '', width: 0 };

    const metaLines: any[] = [];
    if (data.generatedAt) {
        const genDate = formatDateSafe(data.generatedAt, undefined, data.language);
        const genTime = (() => {
            try {
                const d = new Date(data.generatedAt!);
                if (!Number.isFinite(d.getTime())) return '';
                return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            } catch { return ''; }
        })();
        metaLines.push({
            text: isArabic
                ? [`تاريخ استخراج التقرير: `, genDate, genTime ? `  |  وقت الاستخراج: ` : '', genTime]
                : [`Report extraction date: `, genDate, genTime ? `  |  Time: ` : '', genTime],
            fontSize: 8,
            color: PDF_DESIGN.colors.textMuted,
            margin: [0, 2, 0, 0],
        });
    }
    if (data.generatedBy) {
        metaLines.push({
            text: isArabic ? [`تمت الطباعة بواسطة: `, data.generatedBy] : [`Printed by: `, data.generatedBy],
            fontSize: 8,
            color: PDF_DESIGN.colors.textMuted,
            margin: [0, 1, 0, 0],
        });
    }
    metaLines.push({
        text: isArabic ? [`العملة: `, currencyLabel] : [`Currency: `, currencyLabel],
        fontSize: 8,
        color: PDF_DESIGN.colors.textMuted,
        margin: [0, 1, 0, 0],
    });
    if (data.branchName) {
        metaLines.push({
            text: isArabic ? [`الفرع: `, data.branchName] : [`Branch: `, data.branchName],
            fontSize: 8,
            color: PDF_DESIGN.colors.textMuted,
            margin: [0, 1, 0, 0],
        });
    }

    const centerCol = {
        stack: [
            { text: data.companyName, fontSize: 18, bold: true, color: PDF_DESIGN.colors.primary, alignment: 'center' },
            { text: title, fontSize: 14, bold: true, color: PDF_DESIGN.colors.secondary, alignment: 'center', margin: [0, 6, 0, 0] },
            dateValueStr ? { text: `${dateLabelStr} ${dateValueStr}`, fontSize: 11, color: PDF_DESIGN.colors.textLight, alignment: 'center', margin: [0, 4, 0, 0] } : { text: '' },
            ...metaLines.map(l => ({ ...l, alignment: 'center' as const })),
        ],
        width: '*',
    };

    const columns = isArabic ? [{ text: '', width: 'auto' }, centerCol, logoCol] : [logoCol, centerCol, { text: '', width: 'auto' }];
    return {
        stack: [
            { columns, margin: [0, 0, 0, 12] },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: PDF_DESIGN.colors.border }] },
        ],
    } as Content;
}

/** Backward compatibility alias */
export function buildBalanceSheetHeader(data: BalanceSheetHeaderData, logoBase64: string | null): Content {
    const isArabic = data.language === 'ar';
    const dateStr = formatDateSafe(data.asOfDateRaw || data.asOfDate, undefined, data.language);
    return buildFinancialReportHeader({
        ...data,
        dateLabel: 'As of:',
        dateLabelAr: 'كما في تاريخ:',
        dateValue: dateStr,
        dateValueAr: dateStr,
    }, logoBase64);
}

/** Professional financial report footer — page number, version, generation timestamp */
export function buildFinancialReportFooter(data: {
    appVersion?: string;
    generatedAt?: string;
    language?: 'en' | 'ar';
}): (currentPage: number, pageCount: number) => any {
    const isArabic = data.language === 'ar';
    const genStr = formatDateTimeSafe(data.generatedAt);

    return (currentPage: number, pageCount: number) => ({
        columns: [
            {
                text: [
                    data.appVersion ? (isArabic ? `الإصدار ${data.appVersion}` : `v${data.appVersion}`) : '',
                    genStr ? (data.appVersion ? '  •  ' : '') + genStr : '',
                ].filter(Boolean).join('') || ' ',
                fontSize: 7,
                color: PDF_DESIGN.colors.textMuted,
                alignment: isArabic ? 'right' : 'left',
                width: '*',
            },
            {
                text: isArabic ? `صفحة ${currentPage} من ${pageCount}` : `Page ${currentPage} of ${pageCount}`,
                fontSize: 9,
                color: PDF_DESIGN.colors.textMuted,
                alignment: 'center' as const,
                width: 'auto',
            },
            { text: '', width: '*' },
        ],
        padding: [0, 20, 0, 0],
        margin: [40, 10, 40, 0],
    });
}

/** Backward compatibility alias */
export const buildBalanceSheetFooter = buildFinancialReportFooter;
