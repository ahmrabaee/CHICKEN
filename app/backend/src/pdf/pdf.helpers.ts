import { Content, DynamicContent } from 'pdfmake/interfaces';
import { PdfMeta } from './pdf.types';
import { PDF_DESIGN } from './pdf.constants';

/** inline=1 يتجنّب اعتراض IDM على التحميل */
export function getPdfContentDisposition(filename: string, inline?: string): string {
    const disp = (inline === '1' || inline === 'true') ? 'inline' : 'attachment';
    return `${disp}; filename="${filename}"`;
}

export function formatCurrency(amount: number | string): string {
    return Number(amount).toFixed(2);
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

/** Date for header: DD-MM-YYYY with Western numerals — avoids Arabic numeral rendering issues in PDF */
export function formatDateForHeader(date: string | Date | undefined): string {
    if (!date) return '';
    try {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) {
        return String(date);
    }
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
