import { StyleDictionary } from 'pdfmake/interfaces';

export const PDF_DESIGN = {
    // Brand Colors
    colors: {
        primary: '#1a1a2e',        // Dark navy — headers, titles
        secondary: '#16213e',      // Slightly lighter — section headers
        accent: '#0f3460',         // Accent — borders, highlights
        text: '#333333',           // Body text
        textLight: '#666666',      // Secondary text
        textMuted: '#999999',      // Muted text (footer, dates)
        headerBg: '#f0f0f5',       // Table header background
        altRowBg: '#fafafa',       // Alternating row background
        border: '#e0e0e0',         // Table borders
        success: '#27ae60',        // Positive values
        danger: '#e74c3c',         // Negative values
        white: '#ffffff',
    },

    // Typography
    fonts: {
        default: 'Cairo',
        sizes: {
            title: 16,
            subtitle: 12,
            sectionHeader: 11,
            body: 10,
            small: 8,
            footer: 7,
        },
    },

    // Layout
    margins: {
        page: [40, 70, 40, 65] as [number, number, number, number],
        section: [0, 0, 0, 15] as [number, number, number, number],
        paragraph: [0, 0, 0, 8] as [number, number, number, number],
        table: [0, 0, 0, 20] as [number, number, number, number],
    },

    // Footer specific
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
