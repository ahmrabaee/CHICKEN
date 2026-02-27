
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PrismaService } from '../prisma/prisma.service';
import { PdfGenerateOptions, PdfMeta } from './pdf.types';
import { PDF_DESIGN, DEFAULT_STYLES } from './pdf.constants';
import { buildHeader, buildFooter, formatCurrency, formatWeight, formatDateForHeader } from './pdf.helpers';

// pdfmake-rtl: proper Arabic RTL, shaping, bidi
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinterLib = require('pdfmake-rtl/js/Printer');
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

    private isValidFont(filePath: string): boolean {
        try {
            const buf = fs.readFileSync(filePath);
            if (!Buffer.isBuffer(buf) || buf.length < 4) return false;
            const u32 = buf.readUInt32BE(0);
            const tag = buf.toString('ascii', 0, 4);
            return u32 === 0x00010000 || tag === 'OTTO' || tag === 'true';
        } catch {
            return false;
        }
    }

    private initializeFonts() {
        const fontDir = path.join(__dirname, 'fonts');

        // 1) Variable font (single file for all weights)
        const variableFont = path.join(fontDir, 'Cairo-VariableFont_slnt,wght.ttf');
        if (fs.existsSync(variableFont) && this.isValidFont(variableFont)) {
            const cairo = {
                normal: variableFont,
                bold: variableFont,
                italics: variableFont,
                bolditalics: variableFont,
            };
            this.fonts = { Cairo: cairo, Roboto: cairo };
            this.logger.log('Using Cairo variable font (+ RTL)');
            return;
        }

        // 2) Static fonts (Cairo-Regular + Cairo-Bold)
        const cairoPaths = {
            normal: path.join(fontDir, 'Cairo-Regular.ttf'),
            bold: path.join(fontDir, 'Cairo-Bold.ttf'),
            italics: path.join(fontDir, 'Cairo-Regular.ttf'),
            bolditalics: path.join(fontDir, 'Cairo-Bold.ttf'),
        };
        if (fs.existsSync(cairoPaths.normal) && this.isValidFont(cairoPaths.normal)) {
            this.fonts = { Cairo: cairoPaths, Roboto: cairoPaths };
            this.logger.log('Using Cairo static fonts (+ RTL)');
            return;
        }

        // 3) Arial fallback
        const systemFont = 'C:\\Windows\\Fonts\\arial.ttf';
        if (fs.existsSync(systemFont)) {
            this.logger.warn('Using Arial fallback (Cairo missing or invalid)');
            const arial = {
                normal: systemFont,
                bold: 'C:\\Windows\\Fonts\\arialbd.ttf',
                italics: systemFont,
                bolditalics: 'C:\\Windows\\Fonts\\arialbd.ttf',
            };
            this.fonts = { Cairo: arial, Roboto: arial };
        } else {
            throw new Error(`Font missing. Add Cairo-VariableFont_slnt,wght.ttf or Cairo-Regular.ttf to ${fontDir}`);
        }
    }

    private initializeLogo() {
        try {
            const assetsDir = path.join(process.cwd(), 'assets');
            const candidates: { file: string; mime: string }[] = [
                { file: 'logo.jpeg', mime: 'image/jpeg' },
                { file: 'logo.jpg', mime: 'image/jpeg' },
                { file: 'logo.png', mime: 'image/png' },
            ];
            for (const { file, mime } of candidates) {
                const logoPath = path.join(assetsDir, file);
                if (fs.existsSync(logoPath)) {
                    const buffer = fs.readFileSync(logoPath);
                    this.logoBase64 = `data:${mime};base64,${buffer.toString('base64')}`;
                    this.logger.log(`Logo loaded successfully (${file})`);
                    return;
                }
            }
            this.logger.warn('Logo not found in assets/ (logo.jpeg, logo.jpg, logo.png)');
        } catch (e: any) {
            this.logger.error(`Failed to load logo: ${e.message}`);
        }
    }

    async generate(options: PdfGenerateOptions): Promise<Buffer> {
        const { meta, columns, rows, summaryItems, sections, grandTotal } = options;
        const isArabic = meta.language === 'ar';

        const content: any[] = [
            // Spacer (subtitle/period moved to header)
            { text: '', margin: [0, 5, 0, 0] },

            // Meta Info (generatedBy, branchName) - only if present
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
            } as any,

            pageSize: 'A4',
            pageOrientation: options.pageOrientation || 'portrait',
            pageMargins: PDF_DESIGN.margins.page,

            header: (currentPage, pageCount) => buildHeader(meta, this.logoBase64),
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

        // RTL: reverse so after pdfmake-rtl's auto-reversal, Date ends up rightmost
        const displayColumns = isArabic ? [...columns].reverse() : columns;

        const paramHeaders = displayColumns.map((col) => ({
            text: isArabic && col.headerAr ? col.headerAr : col.header,
            style: 'tableHeader',
        }));

        const bodyRows = rows.map((row, rowIndex) => {
            const cellAlignment = (col: any) => {
                if (col.alignment) return col.alignment;
                if (col.format === 'currency' || col.format === 'number') return isArabic ? 'left' : 'right';
                return isArabic ? 'right' : 'left';
            };
            const fillColor = rowIndex % 2 === 1 ? PDF_DESIGN.colors.altRowBg : undefined;
            return displayColumns.map((col) => {
                let val = row[col.field];
                if (col.format === 'currency') val = formatCurrency(val);
                else if (col.format === 'weight') val = formatWeight(val);
                else if (col.format === 'date') val = formatDateForHeader(val);

                return {
                    text: val?.toString() || '',
                    alignment: cellAlignment(col),
                    fillColor,
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
                paddingLeft: () => 10,
                paddingRight: () => 10,
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
        const formatValue = (item: any): string => {
            if (item.format === 'currency') return formatCurrency(item.value);
            if (item.format === 'weight') return formatWeight(item.value);
            if (item.format === 'date') return formatDateForHeader(item.value);
            if (item.format === 'number') return String(Number(item.value));
            return String(item.value ?? '');
        };
        const body = items.map((item) => [
            {
                text: isArabic && item.labelAr ? item.labelAr : item.label,
                style: 'summaryLabel',
                alignment: isArabic ? 'left' : 'right'
            },
            {
                text: formatValue(item),
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
        const keys = [
            'store_name', 'tax_number', 'receipt_header', 'receipt_footer',
            'app.name', 'app.name_en', 'app.version',
            'business_name', 'business_name_en',
            'tax.registration_number',
            'business_address', 'business_phone', 'business_email', 'business_website',
        ];
        const settings = await prisma.systemSetting.findMany({
            where: { key: { in: keys } },
        });

        const map = settings.reduce((acc, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {} as Record<string, string>);

        const storeName = map['business_name'] || map['store_name'] || map['app.name'] || 'Store';
        const storeNameEn = map['business_name_en'] || map['app.name_en'] || 'Store';
        const taxNumber = map['tax.registration_number'] || map['tax_number'];

        return {
            storeName,
            storeNameEn,
            taxNumber: taxNumber || undefined,
            title: map['receipt_header'],
            footer: map['receipt_footer'],
            appName: map['app.name'] || 'برنامج الإدارة المالية',
            appNameEn: map['app.name_en'] || 'Financial Management Program',
            appVersion: map['app.version'] || '1.0.0',
            address: map['business_address'] || undefined,
            phone: map['business_phone'] || undefined,
            email: map['business_email'] || undefined,
            website: map['business_website'] || undefined,
            language,
            generatedAt: new Date().toISOString().split('T')[0],
        };
    }
}

