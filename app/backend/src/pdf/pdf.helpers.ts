import { Content, ContextPageSize, DynamicContent } from 'pdfmake/interfaces';
import { PdfMeta } from './pdf.types';
import { PDF_DESIGN } from './pdf.constants';

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

export function buildHeader(meta: PdfMeta): Content {
    const isArabic = meta.language === 'ar';
    const titleText = isArabic && meta.titleAr ? meta.titleAr : meta.title;

    // Using stacking to center vertically in header space
    return {
        stack: [
            {
                text: titleText,
                style: 'header',
                // Ensure RTL direction for Arabic title if needed, though 'center' handles it mostly
            },
            {
                text: [
                    { text: isArabic ? 'التاريخ: ' : 'Date: ', color: PDF_DESIGN.colors.textMuted },
                    meta.generatedAt,
                ],
                style: 'small',
                alignment: 'center',
                margin: [0, 2, 0, 5],
            },
        ],
        margin: [0, 10, 0, 0], // Top margin inside header area
    };
}

export function buildFooter(meta: PdfMeta, logoBase64: string | null): DynamicContent {
    const isArabic = meta.language === 'ar';

    return (currentPage: number, pageCount: number) => ({
        columns: [
            // Logo (Left or Right based on need, let's put it Left/Right symmetric)
            // Actually, for bilingual docs, consistent layout is better. 
            // Let's put logo on Left always, Store Name on Right.

            // Logo Column
            logoBase64 ? {
                image: logoBase64,
                width: PDF_DESIGN.footer.logoWidth,
                height: PDF_DESIGN.footer.logoHeight,
                margin: [40, 0, 5, 0], // Left margin matches page margin
            } : { text: '', width: 0 },

            // Center: App Name + Page Number
            {
                stack: [
                    {
                        text: isArabic ? 'برنامج الإدارة المالية' : 'Financial Management Program',
                        fontSize: PDF_DESIGN.footer.appNameSize,
                        color: PDF_DESIGN.colors.textMuted,
                        bold: true,
                    },
                    {
                        text: `${currentPage} / ${pageCount}`,
                        fontSize: PDF_DESIGN.footer.pageNumberSize,
                        color: PDF_DESIGN.colors.textMuted,
                    },
                ],
                alignment: 'center',
                width: '*',
                margin: [0, 3, 0, 0],
            },

            // Right: Store Name
            {
                text: meta.storeName || '',
                fontSize: PDF_DESIGN.footer.appNameSize,
                color: PDF_DESIGN.colors.textMuted,
                alignment: 'right',
                width: 'auto',
                margin: [0, 5, 40, 0], // Right margin matches page margin
            },
        ],
        margin: [0, 10, 0, 0],
    });
}
