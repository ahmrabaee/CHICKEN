import { StyleDictionary } from 'pdfmake/interfaces';

export const PDF_DESIGN = {
    // Brand Colors - Professional blue palette
    colors: {
        primary: '#0d47a1',        // Deep blue — headers, titles
        secondary: '#1565c0',     // Section headers
        accent: '#1976d2',        // Borders, highlights
        text: '#212121',          // Body text
        textLight: '#616161',      // Secondary text
        textMuted: '#9e9e9e',     // Muted text (footer, dates)
        headerBg: '#e3f2fd',      // Table header - light blue
        altRowBg: '#f5f5f5',      // Alternating row background
        border: '#e0e0e0',        // Table borders
        success: '#2e7d32',       // Positive values (paid)
        danger: '#c62828',       // Negative values (unpaid)
        warning: '#f9a825',      // Pending
        white: '#ffffff',
    },

    // Typography
    fonts: {
        default: 'Cairo',
        sizes: {
            title: 18,
            subtitle: 12,
            sectionHeader: 11,
            body: 10,
            small: 8,
            footer: 7,
            appName: 14,
            storeName: 11,
        },
    },

    // Layout
    margins: {
        page: [40, 90, 40, 70] as [number, number, number, number],
        section: [0, 0, 0, 15] as [number, number, number, number],
        paragraph: [0, 0, 0, 8] as [number, number, number, number],
        table: [0, 0, 0, 20] as [number, number, number, number],
    },

    // Header / Footer specific
    header: {
        logoWidth: 48,
        logoHeight: 48,
        dividerHeight: 2,
    },
    footer: {
        logoWidth: 20,
        logoHeight: 20,
        appNameSize: 7,
        pageNumberSize: 7,
    },
} as const;

export const DEFAULT_STYLES: StyleDictionary = {
    header: {
        fontSize: PDF_DESIGN.fonts.sizes.title,
        bold: true,
        alignment: 'center',
        color: PDF_DESIGN.colors.primary,
        margin: [0, 0, 0, 5],
    },
    subtitle: {
        fontSize: PDF_DESIGN.fonts.sizes.subtitle,
        alignment: 'center',
        color: PDF_DESIGN.colors.textLight,
        margin: [0, 0, 0, 20],
    },
    sectionHeader: {
        fontSize: PDF_DESIGN.fonts.sizes.sectionHeader,
        bold: true,
        color: PDF_DESIGN.colors.secondary,
        margin: [0, 10, 0, 5],
    },
    tableHeader: {
        bold: true,
        fontSize: PDF_DESIGN.fonts.sizes.body,
        color: PDF_DESIGN.colors.primary,
        fillColor: PDF_DESIGN.colors.headerBg,
        alignment: 'center',
    },
    summaryLabel: {
        bold: true,
        fontSize: PDF_DESIGN.fonts.sizes.body,
        color: PDF_DESIGN.colors.text,
    },
    summaryValue: {
        fontSize: PDF_DESIGN.fonts.sizes.body,
        color: PDF_DESIGN.colors.text,
    },
    small: {
        fontSize: PDF_DESIGN.fonts.sizes.small,
        color: PDF_DESIGN.colors.textMuted,
    },
};
