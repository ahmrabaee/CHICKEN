
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PrismaService } from '../prisma/prisma.service';
import { PdfGenerateOptions, PdfMeta } from './pdf.types';
import { PDF_DESIGN, DEFAULT_STYLES } from './pdf.constants';
import { buildHeader, buildFooter, formatCurrency, formatWeight, formatDate } from './pdf.helpers';

// Use standard pdfmake for stability check (pdfmake-rtl crashed)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinterLib = require('pdfmake/js/Printer');
const PdfPrinter = PdfPrinterLib.default || PdfPrinterLib;

@Injectable()
export class PdfService implements OnModuleInit {
    private readonly logger = new Logger(PdfService.name);
    private fonts: any;
    private logoBase64: string | null = null;
    private printer: any;

    constructor() {
        this.initializeFonts();
        this.initializeLogo();
        this.printer = new PdfPrinter(this.fonts);
    }

    onModuleInit() {
        this.logger.log('PdfService initialized with Cairo fonts and RTL support');
    }

    private initializeFonts() {
        const fontDir = path.join(__dirname, 'fonts');

        // Map Cairo to all styles since it supports both Arabic and English well
        this.fonts = {
            Cairo: {
                normal: path.join(fontDir, 'Cairo-Regular.ttf'),
                bold: path.join(fontDir, 'Cairo-Bold.ttf'),
                italics: path.join(fontDir, 'Cairo-Regular.ttf'),
                bolditalics: path.join(fontDir, 'Cairo-Bold.ttf'),
            },
        };

        // Validate existence
        try {
            if (true || !fs.existsSync(this.fonts.Cairo.normal)) {
                // Fallback for Windows Dev
                const systemFont = 'C:\\Windows\\Fonts\\arial.ttf';
                if (fs.existsSync(systemFont)) {
                    this.logger.warn(`Cairo font missing, falling back to system Arial: ${systemFont}`);
                    this.fonts = {
                        Cairo: {
                            normal: systemFont,
                            bold: 'C:\\Windows\\Fonts\\arialbd.ttf',
                            italics: systemFont,
                            bolditalics: 'C:\\Windows\\Fonts\\arialbd.ttf',
                        }
                    };
                } else {
                    throw new Error(`Font missing: ${this.fonts.Cairo.normal} and system fallback failed`);
                }
            }
        } catch (e: any) {
            this.logger.error(`Font initialization failed: ${e.message}`);
            // Fallback (will likely fail rendering Arabic, but prevents crash)
        }
    }

    private initializeLogo() {
        try {
            const logoPath = path.join(process.cwd(), 'assets', 'logo.png');
            if (fs.existsSync(logoPath)) {
                const buffer = fs.readFileSync(logoPath);
                this.logoBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
                this.logger.log('Logo loaded successfully');
            } else {
                this.logger.warn('Logo not found at assets/logo.png');
            }
        } catch (e: any) {
            this.logger.error(`Failed to load logo: ${e.message}`);
        }
    }

    async generate(options: PdfGenerateOptions): Promise<Buffer> {
        const { meta, columns, rows, summaryItems, sections, grandTotal } = options;
        const isArabic = meta.language === 'ar';

        const content: any[] = [
            // Spacer for header
            { text: '', margin: [0, 10, 0, 0] },

            // Optional Subtitle
            (meta.subtitle || meta.subtitleAr) ? {
                text: isArabic && meta.subtitleAr ? meta.subtitleAr : meta.subtitle,
                style: 'subtitle'
            } : { text: '' },

            // Meta Info Table
            this.buildMetaInfoSection(meta, isArabic),

            // Main Content: Table OR Sections
            (columns && rows) ? this.buildTableSection(columns, rows, isArabic) : { text: '' },
            (sections) ? this.buildFinancialSections(sections, isArabic) : { text: '' },

            // Summary & Totals
            (summaryItems) ? this.buildSummarySection(summaryItems, isArabic) : { text: '' },
            (grandTotal) ? this.buildGrandTotal(grandTotal, isArabic) : { text: '' },
        ];

        // Filter out empty text blocks if needed, but pdfmake handles {text:''} fine.

        const docDefinition: TDocumentDefinitions = {
            defaultStyle: {
                font: PDF_DESIGN.fonts.default,
                fontSize: PDF_DESIGN.fonts.sizes.body,
                alignment: isArabic ? 'right' : 'left',
                direction: isArabic ? 'rtl' : 'ltr',
                // Note: pdfmake-rtl handles complex script shaping automatically
            } as any,

            pageSize: 'A4',
            pageOrientation: options.pageOrientation || 'portrait',
            pageMargins: PDF_DESIGN.margins.page,

            header: (currentPage, pageCount) => buildHeader(meta),
            footer: buildFooter(meta, this.logoBase64),

            content: content,

            styles: DEFAULT_STYLES,
        };

        // Watermark
        if (options.watermark) {
            docDefinition.watermark = {
                text: options.watermark,
                color: 'red',
                opacity: 0.1,
                bold: true,
                italics: false,
            };
        }

        return this.createPdfBuffer(docDefinition);
    }

    private buildMetaInfoSection(meta: PdfMeta, isArabic: boolean) {
        const leftSide: any[] = [];
        const rightSide: any[] = [];

        if (meta.generatedBy) {
            leftSide.push({
                text: [
                    { text: isArabic ? 'بواسطة: ' : 'Generated by: ', bold: true, color: PDF_DESIGN.colors.textLight },
                    meta.generatedBy
                ]
            });
        }
        if (meta.branchName) {
            leftSide.push({
                text: [
                    { text: isArabic ? 'الفرع: ' : 'Branch: ', bold: true, color: PDF_DESIGN.colors.textLight },
                    meta.branchName
                ]
            });
        }

        if (meta.taxNumber) {
            rightSide.push({
                text: [
                    { text: isArabic ? 'الرقم الضريبي: ' : 'Tax Number: ', bold: true, color: PDF_DESIGN.colors.textLight },
                    meta.taxNumber
                ],
                alignment: isArabic ? 'left' : 'right'
            });
        }

        if (leftSide.length === 0 && rightSide.length === 0) return { text: '' };

        return {
            columns: [
                { stack: leftSide, width: '*' },
                { stack: rightSide, width: '*' },
            ],
            margin: PDF_DESIGN.margins.section,
        };
    }

    private buildTableSection(columns: any[], rows: any[], isArabic: boolean) {
        if (!rows.length) return { text: '' };

        // For Arabic, reverse columns for visual order if needed, 
        // BUT pdfmake-rtl handles RTL tables better. 
        // Let's rely on standard order but ensure text alignment is correct.
        // Actually, often in PDF generators, visual column reversal is still safest for Arabic tables.
        const displayColumns = isArabic ? [...columns].reverse() : columns;

        const paramHeaders = displayColumns.map((col) => ({
            text: isArabic && col.headerAr ? col.headerAr : col.header,
            style: 'tableHeader',
        }));

        const bodyRows = rows.map((row) => {
            return displayColumns.map((col) => {
                let val = row[col.field];
                if (col.format === 'currency') val = formatCurrency(val);
                else if (col.format === 'weight') val = formatWeight(val);
                else if (col.format === 'date') val = formatDate(val, isArabic ? 'ar' : 'en');

                return {
                    text: val?.toString() || '',
                    alignment: col.alignment || 'center',
                    // Force direction for mixed content cells
                    direction: isArabic ? 'rtl' : 'ltr',
                };
            });
        });

        return {
            table: {
                headerRows: 1,
                widths: displayColumns.map((c) => c.width || '*'),
                body: [paramHeaders, ...bodyRows],
            },
            layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0,
                hLineColor: () => PDF_DESIGN.colors.border,
                paddingLeft: () => 8,
                paddingRight: () => 8,
                paddingTop: () => 8,
                paddingBottom: () => 8,
            },
            margin: PDF_DESIGN.margins.table,
        };
    }

    private buildFinancialSections(sections: any[], isArabic: boolean) {
        const content: any[] = [];

        sections.forEach((section: any) => {
            const title = isArabic ? section.titleAr : section.title;
            content.push({ text: title, style: 'sectionHeader' });

            section.items.forEach((item: any) => {
                const label = isArabic ? item.labelAr : item.label;
                content.push({
                    columns: [
                        { text: label, width: '*', margin: [(item.indent || 0) * 15, 0, 0, 0] },
                        { text: formatCurrency(item.value), width: 'auto', alignment: 'right' },
                    ],
                    margin: [0, 2, 0, 2],
                });
            });

            if (section.total !== undefined) {
                content.push({
                    columns: [
                        { text: isArabic ? `إجمالي ${title}` : `Total ${title}`, bold: true, width: '*' },
                        { text: formatCurrency(section.total), bold: true, width: 'auto', alignment: 'right' },
                    ],
                    margin: [0, 5, 0, 10],
                });
                // Divider
                content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }] });
            }
        });

        return { stack: content, margin: PDF_DESIGN.margins.table };
    }

    private buildSummarySection(items: any[], isArabic: boolean) {
        // We put summary in a small table aligned to the right (or left for Arabic)
        const body = items.map((item) => [
            {
                text: isArabic && item.labelAr ? item.labelAr : item.label,
                style: 'summaryLabel',
                alignment: isArabic ? 'left' : 'right'
            },
            {
                text: formatCurrency(item.value),
                style: 'summaryValue',
                bold: item.bold,
                alignment: isArabic ? 'right' : 'left'
            }
        ]);

        return {
            columns: [
                { width: '*', text: '' },
                {
                    width: 'auto',
                    table: {
                        widths: ['auto', 100],
                        body: body,
                    },
                    layout: 'noBorders',
                }
            ],
            margin: [0, 10, 0, 0],
        };
    }

    private buildGrandTotal(total: any, isArabic: boolean) {
        return {
            columns: [
                {
                    text: isArabic ? total.labelAr : total.label,
                    fontSize: 12,
                    bold: true,
                    alignment: isArabic ? 'left' : 'right',
                    width: '*'
                },
                {
                    text: formatCurrency(total.value),
                    fontSize: 12,
                    bold: true,
                    alignment: isArabic ? 'right' : 'left',
                    width: 'auto'
                }
            ],
            margin: [0, 20, 0, 0],
            style: { fillColor: PDF_DESIGN.colors.headerBg } // finish with a highlight? maybe just text
        };
    }

    private async createPdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
        try {
            const pdfDoc = await this.printer.createPdfKitDocument(docDefinition);

            return new Promise((resolve, reject) => {
                const chunks: Uint8Array[] = [];
                pdfDoc.on('data', (chunk: any) => chunks.push(chunk));
                pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
                pdfDoc.on('error', (err: any) => reject(err));
                pdfDoc.end();
            });
        } catch (err: any) {
            this.logger.error(`Error generating PDF: ${err.message}`, err.stack);
            throw err;
        }
    }

    async getStoreMeta(prisma: PrismaService, language: 'en' | 'ar'): Promise<Partial<PdfMeta>> {
        const settings = await prisma.systemSetting.findMany({
            where: { key: { in: ['store_name', 'tax_number', 'receipt_header', 'receipt_footer'] } },
        });

        const map = settings.reduce((acc, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {} as Record<string, string>);

        return {
            storeName: map['store_name'] || 'Store Name',
            taxNumber: map['tax_number'],
            title: map['receipt_header'],
            footer: map['receipt_footer'],
            language,
            generatedAt: new Date().toISOString().split('T')[0],
        };
    }
}

