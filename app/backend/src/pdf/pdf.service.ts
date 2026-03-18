
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PrismaService } from '../prisma/prisma.service';
import { formatCurrency, formatCurrencyDisplay, formatCurrencySafe, formatDateForHeader, formatDateSafe, formatWeight, getCurrencyReportLabel, buildFinancialReportHeader, buildFinancialReportFooter, buildHeader, buildFooter } from './pdf.helpers';
import { BalanceSheetPdfData, IncomeStatementPdfData, PdfGenerateOptions, PdfMeta, PdfSection, TrialBalancePdfData } from './pdf.types';
import { PDF_DESIGN, DEFAULT_STYLES } from './pdf.constants';

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
        const {
            meta, columns, rows, summaryItems, sections, grandTotal,
            statementEmpty, statementPartyInfo, statementAccountInfo,
            balanceSheetData, incomeStatementData, trialBalanceData
        } = options;
        const isArabic = meta.language === 'ar';

        // High-level Financial Reports: matching premium layouts
        if (balanceSheetData) return this.generateBalanceSheet(balanceSheetData);
        if (incomeStatementData) return this.generateIncomeStatement(incomeStatementData);
        if (trialBalanceData) return this.generateTrialBalance(trialBalanceData);

        const mainContent = statementEmpty
            ? {
                text: statementEmpty,
                alignment: 'center' as const,
                margin: [0, 40, 0, 0],
                fontSize: 12,
                color: PDF_DESIGN.colors.textLight,
            }
            : (columns && rows && rows.length) ? this.buildTableSection(columns, rows, isArabic) : (sections ? this.buildFinancialSections(sections, isArabic) : { text: '' });

        const content: any[] = [
            { text: '', margin: [0, 5, 0, 0] },
            this.buildMetaInfoSection(meta, isArabic),
            statementPartyInfo ? this.buildStatementPartyInfoSection(statementPartyInfo, isArabic) : { text: '' },
            statementAccountInfo ? this.buildStatementAccountInfoSection(statementAccountInfo, isArabic) : { text: '' },
            mainContent,
            (summaryItems && !statementEmpty) ? this.buildSummarySection(summaryItems, isArabic) : { text: '' },
            (grandTotal) ? this.buildGrandTotal(grandTotal, isArabic) : { text: '' },
        ];

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
            header: () => buildHeader(meta, this.logoBase64),
            footer: buildFooter(meta, this.logoBase64),
            content,
            styles: DEFAULT_STYLES,
        };

        if (options.watermark) {
            docDefinition.watermark = { text: options.watermark, color: 'red', opacity: 0.1, bold: true };
        }

        return this.createPdfBuffer(docDefinition);
    }

    /** Generate professional Balance Sheet PDF with 3-column table, dedicated header/footer */
    private async generateBalanceSheet(data: BalanceSheetPdfData): Promise<Buffer> {
        const isArabic = data.language === 'ar';
        const content = this.buildBalanceSheetContent(data);
        const dateStr = formatDateSafe(data.asOfDateRaw || data.asOfDate, undefined, data.language);

        const docDefinition: TDocumentDefinitions = {
            defaultStyle: { font: PDF_DESIGN.fonts.default, fontSize: PDF_DESIGN.fonts.sizes.body, alignment: isArabic ? 'right' : 'left', direction: isArabic ? 'rtl' : 'ltr' } as any,
            pageSize: 'A4',
            pageOrientation: 'portrait',
            pageMargins: [40, 100, 40, 80] as [number, number, number, number],
            header: () => buildFinancialReportHeader({ ...data, dateLabel: 'As of:', dateLabelAr: 'كما في تاريخ:', dateValue: dateStr, dateValueAr: dateStr }, this.logoBase64),
            footer: buildFinancialReportFooter({ appVersion: data.appVersion, generatedAt: data.generatedAt, language: data.language }),
            content,
            styles: DEFAULT_STYLES,
        };
        return this.createPdfBuffer(docDefinition);
    }

    /** Generate professional Income Statement PDF — matches Balance Sheet quality, RTL, header/footer */
    private async generateIncomeStatement(data: IncomeStatementPdfData): Promise<Buffer> {
        const isArabic = data.language === 'ar';
        const content = this.buildIncomeStatementContent(data);

        const startFmt = formatDateSafe(data.startDate, undefined, data.language);
        const endFmt = formatDateSafe(data.endDate, undefined, data.language);
        const periodStr = isArabic
            ? `للفترة من: ${startFmt} إلى: ${endFmt}`
            : `Period from: ${startFmt} to: ${endFmt}`;
        const currencyLabel = getCurrencyReportLabel(data.language, data.currency);

        const docDefinition: TDocumentDefinitions = {
            defaultStyle: { font: PDF_DESIGN.fonts.default, fontSize: PDF_DESIGN.fonts.sizes.body, alignment: isArabic ? 'right' : 'left', direction: isArabic ? 'rtl' : 'ltr' } as any,
            pageSize: 'A4',
            pageOrientation: 'portrait',
            pageMargins: [40, 100, 40, 80] as [number, number, number, number],
            header: () => buildFinancialReportHeader({ ...data, dateLabel: 'Period:', dateLabelAr: 'الفترة:', dateValue: periodStr, dateValueAr: periodStr, currency: currencyLabel }, this.logoBase64),
            footer: buildFinancialReportFooter({ appVersion: data.appVersion, generatedAt: data.generatedAt, language: data.language }),
            content,
            styles: DEFAULT_STYLES,
        };
        return this.createPdfBuffer(docDefinition);
    }

    /** Generate professional Trial Balance PDF with 8-column table, dedicated header/footer */
    private async generateTrialBalance(data: TrialBalancePdfData): Promise<Buffer> {
        const isArabic = data.language === 'ar';
        const content = this.buildTrialBalanceContent(data);

        const docDefinition: TDocumentDefinitions = {
            defaultStyle: { font: PDF_DESIGN.fonts.default, fontSize: PDF_DESIGN.fonts.sizes.small, alignment: isArabic ? 'right' : 'left', direction: isArabic ? 'rtl' : 'ltr' } as any,
            pageSize: 'A4',
            pageOrientation: 'landscape',
            pageMargins: [30, 90, 30, 70] as [number, number, number, number],
            header: () => {
                const dateRange = (data.startDate && data.startDate !== 'Start')
                    ? (formatDateForHeader(data.startDate) + (isArabic ? ' إلى ' : ' to ') + formatDateForHeader(data.endDate))
                    : (isArabic ? `حتى تاريخ ${formatDateForHeader(data.endDate)}` : `Up to ${formatDateForHeader(data.endDate)}`);

                return buildFinancialReportHeader({ ...data, dateLabel: 'Period:', dateLabelAr: 'للفترة من:', dateValue: dateRange, dateValueAr: dateRange }, this.logoBase64);
            },
            footer: buildFinancialReportFooter({ appVersion: data.appVersion, generatedAt: data.generatedAt, language: data.language }),
            content,
            styles: DEFAULT_STYLES,
        };
        return this.createPdfBuffer(docDefinition);
    }

    /** Build 3-column table content for Balance Sheet */
    private buildBalanceSheetContent(data: BalanceSheetPdfData): any[] {
        const isArabic = data.language === 'ar';
        const codeW = 75;
        const nameW = '*';
        const amountW = 95;
        const amountSymbol = '₪';
        const COLS = isArabic ? [amountW, nameW, codeW] : [codeW, nameW, amountW];
        const amountHeader = isArabic ? `المبلغ (${amountSymbol})` : `Amount (${amountSymbol})`;
        const headerRow = [
            { text: amountHeader, bold: true, fillColor: PDF_DESIGN.colors.headerBg, alignment: isArabic ? 'left' : 'right', border: [false, false, false, true] },
            { text: isArabic ? 'اسم الحساب' : 'Account Name', bold: true, fillColor: PDF_DESIGN.colors.headerBg, alignment: 'right', border: [false, false, false, true] },
            { text: isArabic ? 'كود الحساب' : 'Account Code', bold: true, fillColor: PDF_DESIGN.colors.headerBg, alignment: 'right', border: [false, false, false, true] },
        ];
        if (!isArabic) headerRow.reverse();

        const out: any[] = [];
        for (const section of data.sections) {
            out.push({ text: isArabic ? section.titleAr : section.title, style: 'sectionHeader', margin: [0, 18, 0, 8] });
            const body: any[] = [headerRow];
            for (const row of section.rows) {
                const name = isArabic && row.nameAr ? row.nameAr : row.name;
                const r = [
                    { text: formatCurrencyDisplay(row.value), alignment: isArabic ? 'left' : 'right', border: [false, false, false, false] },
                    { text: name || '—', alignment: 'right', border: [false, false, false, false] },
                    { text: row.code || '—', alignment: 'right', border: [false, false, false, false] },
                ];
                if (!isArabic) r.reverse();
                body.push(r);
            }
            const totalR = [
                { text: formatCurrencyDisplay(section.total), bold: true, fillColor: '#f5f5f5', alignment: isArabic ? 'left' : 'right', border: [false, true, false, false] },
                { text: isArabic ? `إجمالي ${section.titleAr}` : `Total ${section.title}`, bold: true, fillColor: '#f5f5f5', alignment: 'right', border: [false, true, false, false] },
                { text: '', fillColor: '#f5f5f5', border: [false, true, false, false] },
            ];
            if (!isArabic) totalR.reverse();
            body.push(totalR);
            out.push({ table: { widths: COLS, body, layout: { hLineWidth: () => 0, vLineWidth: () => 0 } }, margin: [0, 0, 0, 16] });
        }

        const grandTotalRow = [
            { text: formatCurrencyDisplay(data.grandTotalValue), bold: true, fillColor: '#e8eaf6', alignment: isArabic ? 'left' : 'right', border: [false, true, false, false], padding: [0, 10, 0, 10] },
            { text: isArabic ? data.grandTotalLabelAr : data.grandTotalLabel, bold: true, fillColor: '#e8eaf6', alignment: 'right', border: [false, true, false, false], padding: [0, 10, 0, 10] },
            { text: '', fillColor: '#e8eaf6', border: [false, true, false, false], padding: [0, 10, 0, 10] },
        ];
        if (!isArabic) grandTotalRow.reverse();
        out.push({ table: { widths: COLS, body: [grandTotalRow], layout: { hLineWidth: () => 0, vLineWidth: () => 0 } }, margin: [0, 12, 0, 0] });
        return out;
    }

    /** Build 8-column table content for Trial Balance: Code | Name | Opening D/C | Period D/C | Ending D/C */
    private buildTrialBalanceContent(data: TrialBalancePdfData): any[] {
        const isArabic = data.language === 'ar';
        const codeW = 45;
        const nameW = '*';
        const amountW = 62;
        
        const COLS = isArabic
            ? [amountW, amountW, amountW, amountW, amountW, amountW, nameW, codeW]
            : [codeW, nameW, amountW, amountW, amountW, amountW, amountW, amountW];

        // Define rows explicitly to avoid .reverse() breaking colSpan/rowSpan logic
        let headerRow1: any[];
        let headerRow2: any[];

        if (isArabic) {
            headerRow1 = [
                { text: 'رصيد آخر', bold: true, fillColor: '#e8ecf1', colSpan: 2, alignment: 'center' },
                {},
                { text: 'حركة الفترة', bold: true, fillColor: '#eef2f6', colSpan: 2, alignment: 'center' },
                {},
                { text: 'رصيد أول المدة', bold: true, fillColor: '#f0f4f8', colSpan: 2, alignment: 'center' },
                {},
                { text: 'اسم الحساب', bold: true, fillColor: PDF_DESIGN.colors.headerBg, rowSpan: 2, margin: [0, 8, 0, 0] },
                { text: 'كود', bold: true, fillColor: PDF_DESIGN.colors.headerBg, rowSpan: 2, margin: [0, 8, 0, 0] },
            ];
            headerRow2 = [
                { text: 'دائن', bold: true, fillColor: '#e8ecf1', alignment: 'center' },
                { text: 'مدين', bold: true, fillColor: '#e8ecf1', alignment: 'center' },
                { text: 'دائن', bold: true, fillColor: '#eef2f6', alignment: 'center' },
                { text: 'مدين', bold: true, fillColor: '#eef2f6', alignment: 'center' },
                { text: 'دائن', bold: true, fillColor: '#f0f4f8', alignment: 'center' },
                { text: 'مدين', bold: true, fillColor: '#f0f4f8', alignment: 'center' },
                {},
                {},
            ];
        } else {
            headerRow1 = [
                { text: 'Code', bold: true, fillColor: PDF_DESIGN.colors.headerBg, rowSpan: 2, margin: [0, 8, 0, 0] },
                { text: 'Account Name', bold: true, fillColor: PDF_DESIGN.colors.headerBg, rowSpan: 2, margin: [0, 8, 0, 0] },
                { text: 'Opening Bal', bold: true, fillColor: '#f0f4f8', colSpan: 2, alignment: 'center' },
                {},
                { text: 'Movement', bold: true, fillColor: '#eef2f6', colSpan: 2, alignment: 'center' },
                {},
                { text: 'Ending Bal', bold: true, fillColor: '#e8ecf1', colSpan: 2, alignment: 'center' },
                {},
            ];
            headerRow2 = [
                {}, {},
                { text: 'Dr', bold: true, fillColor: '#f0f4f8', alignment: 'center' },
                { text: 'Cr', bold: true, fillColor: '#f0f4f8', alignment: 'center' },
                { text: 'Dr', bold: true, fillColor: '#eef2f6', alignment: 'center' },
                { text: 'Cr', bold: true, fillColor: '#eef2f6', alignment: 'center' },
                { text: 'Dr', bold: true, fillColor: '#e8ecf1', alignment: 'center' },
                { text: 'Cr', bold: true, fillColor: '#e8ecf1', alignment: 'center' },
            ];
        }

        const body: any[] = [headerRow1, headerRow2];
        for (const row of data.rows) {
            const name = isArabic && row.nameAr ? row.nameAr : row.name;
            const cells = isArabic ? [
                { text: formatCurrencyDisplay(row.endingCredit), alignment: 'left' },
                { text: formatCurrencyDisplay(row.endingDebit), alignment: 'left' },
                { text: formatCurrencyDisplay(row.periodCredit), alignment: 'left' },
                { text: formatCurrencyDisplay(row.periodDebit), alignment: 'left' },
                { text: formatCurrencyDisplay(row.openingCredit), alignment: 'left' },
                { text: formatCurrencyDisplay(row.openingDebit), alignment: 'left' },
                { text: name, alignment: 'right' },
                { text: row.code, alignment: 'center' },
            ] : [
                { text: row.code, alignment: 'center' },
                { text: name, alignment: 'right' },
                { text: formatCurrencyDisplay(row.openingDebit), alignment: 'left' },
                { text: formatCurrencyDisplay(row.openingCredit), alignment: 'left' },
                { text: formatCurrencyDisplay(row.periodDebit), alignment: 'left' },
                { text: formatCurrencyDisplay(row.periodCredit), alignment: 'left' },
                { text: formatCurrencyDisplay(row.endingDebit), alignment: 'left' },
                { text: formatCurrencyDisplay(row.endingCredit), alignment: 'left' },
            ];
            body.push(cells);
        }

        const totalsRow = isArabic ? [
            { text: formatCurrencyDisplay(data.totalEndingCredit), bold: true, fillColor: '#fafafa', alignment: 'left' },
            { text: formatCurrencyDisplay(data.totalEndingDebit), bold: true, fillColor: '#fafafa', alignment: 'left' },
            { text: formatCurrencyDisplay(data.totalPeriodCredit), bold: true, fillColor: '#fafafa', alignment: 'left' },
            { text: formatCurrencyDisplay(data.totalPeriodDebit), bold: true, fillColor: '#fafafa', alignment: 'left' },
            { text: formatCurrencyDisplay(data.totalOpeningCredit), bold: true, fillColor: '#fafafa', alignment: 'left' },
            { text: formatCurrencyDisplay(data.totalOpeningDebit), bold: true, fillColor: '#fafafa', alignment: 'left' },
            { text: 'الإجمالي', bold: true, colSpan: 2, fillColor: '#fafafa', alignment: 'center' },
            {},
        ] : [
            { text: 'Total', bold: true, colSpan: 2, fillColor: '#fafafa', alignment: 'center' },
            {},
            { text: formatCurrencyDisplay(data.totalOpeningDebit), bold: true, fillColor: '#fafafa', alignment: 'left' },
            { text: formatCurrencyDisplay(data.totalOpeningCredit), bold: true, fillColor: '#fafafa', alignment: 'left' },
            { text: formatCurrencyDisplay(data.totalPeriodDebit), bold: true, fillColor: '#fafafa', alignment: 'left' },
            { text: formatCurrencyDisplay(data.totalPeriodCredit), bold: true, fillColor: '#fafafa', alignment: 'left' },
            { text: formatCurrencyDisplay(data.totalEndingDebit), bold: true, fillColor: '#fafafa', alignment: 'left' },
            { text: formatCurrencyDisplay(data.totalEndingCredit), bold: true, fillColor: '#fafafa', alignment: 'left' },
        ];
        body.push(totalsRow);

        return [
            {
                margin: [0, 0, 0, 15],
                table: {
                    widths: ['*'],
                    body: [[{
                        text: data.isBalanced ? (isArabic ? '✔ الميزان متوازن' : '✔ Balance is Balanced') : (isArabic ? '⚠ الميزان غير متوازن' : '⚠ Balance is NOT Balanced'),
                        bold: true, color: data.isBalanced ? '#2e7d32' : '#c62828', fillColor: data.isBalanced ? '#e8f5e9' : '#ffebee', alignment: 'center' as const, padding: [0, 8, 0, 8],
                    }]]
                },
                layout: 'noBorders'
            },
            {
                table: { headerRows: 2, widths: COLS, body, dontBreakRows: true },
                layout: {
                    hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === 2 || i === node.table.body.length - 1 || i === node.table.body.length) ? 1 : 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: (i: number) => (i === 1 || i === 2) ? PDF_DESIGN.colors.primary : '#e0e0e0',
                    vLineColor: () => '#e0e0e0',
                    paddingLeft: () => 4, paddingRight: () => 4,
                }
            }
        ];
    }

    /** Build Income Statement content: كود الحساب | اسم الحساب | المبلغ (₪) — accounting-grade hierarchy */
    private buildIncomeStatementContent(data: import('./pdf.types').IncomeStatementPdfData): any[] {
        const isArabic = data.language === 'ar';
        const codeW = 75;
        const nameW = '*';
        const amountW = 95;
        const amountSymbol = '₪';
        const COLS = isArabic ? [amountW, nameW, codeW] : [codeW, nameW, amountW];

        const amountHeader = isArabic ? `المبلغ (${amountSymbol})` : `Amount (${amountSymbol})`;
        const headerRow = [
            { text: amountHeader, bold: true, fillColor: PDF_DESIGN.colors.headerBg, alignment: isArabic ? 'left' : 'right', border: [false, false, false, true] },
            { text: isArabic ? 'اسم الحساب' : 'Account Name', bold: true, fillColor: PDF_DESIGN.colors.headerBg, alignment: 'right', border: [false, false, false, true] },
            { text: isArabic ? 'كود الحساب' : 'Account Code', bold: true, fillColor: PDF_DESIGN.colors.headerBg, alignment: 'right', border: [false, false, false, true] },
        ];
        if (!isArabic) headerRow.reverse();

        const safeNum = (n: number | undefined | null) => (n != null && Number.isFinite(n) ? n : 0);
        const out: any[] = [];

        // 1) الإيرادات (Revenue)
        const revenueSection = data.sections[0];
        const totalRevenue = safeNum(revenueSection?.total);
        const totalRevLabel = isArabic ? 'إجمالي الإيرادات' : 'Total Revenue';

        out.push({ text: isArabic ? (revenueSection?.titleAr ?? 'الإيرادات') : (revenueSection?.title ?? 'Revenue'), style: 'sectionHeader', margin: [0, 0, 0, 8] });
        const revBody: any[] = [headerRow];
        for (const row of revenueSection?.rows ?? []) {
            const displayName = ((isArabic && row.nameAr ? row.nameAr : row.name) || '').trim() || (isArabic ? '—' : '—');
            const val = safeNum(row.value);
            revBody.push([
                { text: formatCurrencyDisplay(val), alignment: isArabic ? 'left' : 'right', border: [false, false, false, false] },
                { text: displayName, alignment: 'right', border: [false, false, false, false] },
                { text: (row.code || '').trim() || '—', alignment: 'right', border: [false, false, false, false] },
            ]);
            if (!isArabic) revBody[revBody.length - 1].reverse();
        }
        revBody.push([
            { text: formatCurrencyDisplay(totalRevenue), bold: true, fillColor: '#f5f5f5', alignment: isArabic ? 'left' : 'right', border: [false, true, false, false] },
            { text: totalRevLabel, bold: true, fillColor: '#f5f5f5', alignment: 'right', border: [false, true, false, false] },
            { text: '', fillColor: '#f5f5f5', border: [false, true, false, false] },
        ]);
        if (!isArabic) revBody[revBody.length - 1].reverse();
        out.push({ table: { widths: COLS, body: revBody, layout: { hLineWidth: () => 0, vLineWidth: () => 0 } }, margin: [0, 0, 0, 16] });

        // 2) تكلفة البضاعة المباعة (COGS)
        const cogsSection = data.sections[1];
        const totalCogs = safeNum(cogsSection?.total);
        const grossProfit = totalRevenue - totalCogs;
        const grossProfitLabel = isArabic ? 'مجمل الربح' : 'Gross Profit';

        out.push({ text: isArabic ? (cogsSection?.titleAr ?? 'تكلفة البضاعة المباعة') : (cogsSection?.title ?? 'Cost of Goods Sold'), style: 'sectionHeader', margin: [0, 18, 0, 8] });
        const cogsBody: any[] = [headerRow];
        for (const row of cogsSection?.rows ?? []) {
            const displayName = ((isArabic && row.nameAr ? row.nameAr : row.name) || '').trim() || (isArabic ? '—' : '—');
            const val = safeNum(row.value);
            cogsBody.push([
                { text: formatCurrencyDisplay(val), alignment: isArabic ? 'left' : 'right', border: [false, false, false, false] },
                { text: displayName, alignment: 'right', border: [false, false, false, false] },
                { text: (row.code || '').trim() || '—', alignment: 'right', border: [false, false, false, false] },
            ]);
            if (!isArabic) cogsBody[cogsBody.length - 1].reverse();
        }
        cogsBody.push([
            { text: formatCurrencyDisplay(totalCogs), bold: true, fillColor: '#f5f5f5', alignment: isArabic ? 'left' : 'right', border: [false, true, false, false] },
            { text: isArabic ? 'إجمالي تكلفة البضاعة المباعة' : 'Total COGS', bold: true, fillColor: '#f5f5f5', alignment: 'right', border: [false, true, false, false] },
            { text: '', fillColor: '#f5f5f5', border: [false, true, false, false] },
        ]);
        if (!isArabic) cogsBody[cogsBody.length - 1].reverse();
        out.push({ table: { widths: COLS, body: cogsBody, layout: { hLineWidth: () => 0, vLineWidth: () => 0 } }, margin: [0, 0, 0, 4] });

        // مجمل الربح (Gross Profit) — emphasized
        const gpRow = [
            { text: formatCurrencyDisplay(grossProfit), bold: true, fillColor: '#e8f5e9', alignment: isArabic ? 'left' : 'right', border: [false, true, false, true], padding: [0, 10, 0, 10] },
            { text: grossProfitLabel, bold: true, fillColor: '#e8f5e9', alignment: 'right', border: [false, true, false, true], padding: [0, 10, 0, 10] },
            { text: '', fillColor: '#e8f5e9', border: [false, true, false, true], padding: [0, 10, 0, 10] },
        ];
        if (!isArabic) gpRow.reverse();
        out.push({ table: { widths: COLS, body: [gpRow], layout: { hLineWidth: () => 0, vLineWidth: () => 0 } }, margin: [0, 0, 0, 18] });

        // 3) المصروفات التشغيلية (Operating Expenses)
        const opexSection = data.sections[2];
        const totalOpex = safeNum(opexSection?.total);
        const operatingProfit = grossProfit - totalOpex;
        const totalOpexLabel = isArabic ? 'إجمالي المصروفات التشغيلية' : 'Total Operating Expenses';
        const opProfitLabel = isArabic ? 'الربح التشغيلي' : 'Operating Profit';

        out.push({ text: isArabic ? (opexSection?.titleAr ?? 'المصروفات التشغيلية') : (opexSection?.title ?? 'Operating Expenses'), style: 'sectionHeader', margin: [0, 0, 0, 8] });
        const opexBody: any[] = [headerRow];
        for (const row of opexSection?.rows ?? []) {
            const displayName = ((isArabic && row.nameAr ? row.nameAr : row.name) || '').trim() || (isArabic ? '—' : '—');
            const val = safeNum(row.value);
            opexBody.push([
                { text: formatCurrencyDisplay(val), alignment: isArabic ? 'left' : 'right', border: [false, false, false, false] },
                { text: displayName, alignment: 'right', border: [false, false, false, false] },
                { text: (row.code || '').trim() || '—', alignment: 'right', border: [false, false, false, false] },
            ]);
            if (!isArabic) opexBody[opexBody.length - 1].reverse();
        }
        opexBody.push([
            { text: formatCurrencyDisplay(totalOpex), bold: true, fillColor: '#f5f5f5', alignment: isArabic ? 'left' : 'right', border: [false, true, false, false] },
            { text: totalOpexLabel, bold: true, fillColor: '#f5f5f5', alignment: 'right', border: [false, true, false, false] },
            { text: '', fillColor: '#f5f5f5', border: [false, true, false, false] },
        ]);
        if (!isArabic) opexBody[opexBody.length - 1].reverse();
        out.push({ table: { widths: COLS, body: opexBody, layout: { hLineWidth: () => 0, vLineWidth: () => 0 } }, margin: [0, 0, 0, 4] });

        // الربح التشغيلي (Operating Profit) — medium emphasis
        const opRow = [
            { text: formatCurrencyDisplay(operatingProfit), bold: true, fillColor: '#e3f2fd', alignment: isArabic ? 'left' : 'right', border: [false, true, false, true], padding: [0, 10, 0, 10] },
            { text: opProfitLabel, bold: true, fillColor: '#e3f2fd', alignment: 'right', border: [false, true, false, true], padding: [0, 10, 0, 10] },
            { text: '', fillColor: '#e3f2fd', border: [false, true, false, true], padding: [0, 10, 0, 10] },
        ];
        if (!isArabic) opRow.reverse();
        out.push({ table: { widths: COLS, body: [opRow], layout: { hLineWidth: () => 0, vLineWidth: () => 0 } }, margin: [0, 0, 0, 12] });

        // 4) صافي الربح (Net Income) — strongest emphasis
        const netVal = safeNum(data.netIncomeValue);
        const netLabel = (data.netIncomeLabelAr && isArabic) ? data.netIncomeLabelAr : (data.netIncomeLabel ?? 'Net Income');
        const netRow = [
            { text: formatCurrencyDisplay(netVal), bold: true, fillColor: '#e8eaf6', alignment: isArabic ? 'left' : 'right', border: [false, true, false, false], padding: [0, 12, 0, 12] },
            { text: netLabel, bold: true, fillColor: '#e8eaf6', alignment: 'right', border: [false, true, false, false], padding: [0, 12, 0, 12] },
            { text: '', fillColor: '#e8eaf6', border: [false, true, false, false], padding: [0, 12, 0, 12] },
        ];
        if (!isArabic) netRow.reverse();
        out.push({ table: { widths: COLS, body: [netRow], layout: { hLineWidth: () => 0, vLineWidth: () => 0 } }, margin: [0, 12, 0, 0] });

        return out;
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

    private buildStatementPartyInfoSection(
        info: NonNullable<PdfGenerateOptions['statementPartyInfo']>,
        isArabic: boolean,
    ) {
        const fmt = (d: string) => formatDateForHeader(d);
        const rows: any[] = [
            {
                text: [
                    { text: isArabic ? 'اسم العميل: ' : 'Customer: ', bold: true, color: PDF_DESIGN.colors.textMuted, fontSize: 10 },
                    { text: info.partyName, bold: true, fontSize: 11 },
                ],
                margin: [0, 0, 0, 4],
            },
        ];
        if (info.partyNumber) {
            rows.push({
                text: [
                    { text: isArabic ? 'رقم العميل: ' : 'Customer No: ', bold: true, color: PDF_DESIGN.colors.textMuted, fontSize: 10 },
                    info.partyNumber,
                ],
                margin: [0, 0, 0, 4],
            });
        }
        if (info.partyPhone) {
            rows.push({
                text: [
                    { text: isArabic ? 'الهاتف: ' : 'Phone: ', bold: true, color: PDF_DESIGN.colors.textMuted, fontSize: 10 },
                    info.partyPhone,
                ],
                margin: [0, 0, 0, 4],
            });
        }
        if (info.partyAddress) {
            rows.push({
                text: [
                    { text: isArabic ? 'العنوان: ' : 'Address: ', bold: true, color: PDF_DESIGN.colors.textMuted, fontSize: 10 },
                    info.partyAddress,
                ],
                margin: [0, 0, 0, 4],
            });
        }
        if (info.partyTaxNumber) {
            rows.push({
                text: [
                    { text: isArabic ? 'الرقم الضريبي: ' : 'Tax No: ', bold: true, color: PDF_DESIGN.colors.textMuted, fontSize: 10 },
                    info.partyTaxNumber,
                ],
                margin: [0, 0, 0, 4],
            });
        }
        rows.push({
            text: [
                { text: isArabic ? 'الفترة: ' : 'Period: ', bold: true, color: PDF_DESIGN.colors.textMuted, fontSize: 10 },
                `${fmt(info.startDate)} — ${fmt(info.endDate)}`,
            ],
            margin: [0, 0, 0, 4],
        });
        rows.push({
            text: [
                { text: isArabic ? 'تاريخ الإصدار: ' : 'Issue Date: ', bold: true, color: PDF_DESIGN.colors.textMuted, fontSize: 10 },
                fmt(info.issueDate),
            ],
            margin: [0, 0, 0, 0],
        });

        return {
            table: {
                widths: ['*'],
                body: [[{ stack: rows, border: [false, false, false, false], fillColor: '#f8fafc', padding: 12 }]],
            },
            layout: 'noBorders',
            margin: [0, 12, 0, 16],
        };
    }

    private buildStatementAccountInfoSection(
        info: NonNullable<PdfGenerateOptions['statementAccountInfo']>,
        isArabic: boolean,
    ) {
        const fmt = (d: string) => formatDateForHeader(d);
        const rows: any[] = [
            {
                text: [
                    { text: isArabic ? 'اسم الحساب: ' : 'Account Name: ', bold: true, color: PDF_DESIGN.colors.textMuted, fontSize: 10 },
                    { text: info.accountName, bold: true, fontSize: 11 },
                ],
                margin: [0, 0, 0, 4],
            },
            {
                text: [
                    { text: isArabic ? 'رقم الحساب: ' : 'Account Code: ', bold: true, color: PDF_DESIGN.colors.textMuted, fontSize: 10 },
                    info.accountCode,
                ],
                margin: [0, 0, 0, 4],
            },
            {
                text: [
                    { text: isArabic ? 'تاريخ استخراج الكشف: ' : 'Report Extraction Date: ', bold: true, color: PDF_DESIGN.colors.textMuted, fontSize: 10 },
                    fmt(info.extractionDate),
                ],
                margin: [0, 0, 0, 0],
            },
        ];

        return {
            table: {
                widths: ['*'],
                body: [[{ stack: rows, border: [false, false, false, false], fillColor: '#f8fafc', padding: 12 }]],
            },
            layout: 'noBorders',
            margin: [0, 12, 0, 16],
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
        const amountWidth = 90;

        sections.forEach((section: any) => {
            const title = isArabic ? section.titleAr : section.title;
            content.push({ text: title, style: 'sectionHeader' });

            const body: any[] = [];

            section.items.forEach((item: any) => {
                const label = isArabic ? item.labelAr : item.label;
                const indent = (item.indent || 0) * 14;
                body.push([
                    {
                        text: label,
                        margin: [isArabic ? 0 : indent, 3, isArabic ? indent : 0, 3],
                        alignment: isArabic ? 'right' : 'left',
                        border: [false, false, false, false],
                    },
                    {
                        text: formatCurrency(item.value),
                        width: amountWidth,
                        alignment: isArabic ? 'left' : 'right',
                        border: [false, false, false, false],
                        margin: [0, 3, 0, 3],
                    },
                ]);
            });

            if (section.total !== undefined) {
                body.push([
                    {
                        text: isArabic ? `إجمالي ${title}` : `Total ${title}`,
                        bold: true,
                        border: [false, false, false, false],
                        margin: [0, 6, 0, 6],
                        alignment: isArabic ? 'right' : 'left',
                    },
                    {
                        text: formatCurrency(section.total),
                        bold: true,
                        width: amountWidth,
                        alignment: isArabic ? 'left' : 'right',
                        border: [false, false, false, false],
                        margin: [0, 6, 0, 6],
                    },
                ]);
            }

            content.push({
                table: {
                    widths: ['*', amountWidth],
                    body,
                    layout: 'noBorders',
                },
                margin: [0, 0, 0, 12],
            });

            content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 0, 0, 8] });
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
                    text: formatCurrencySafe(total.value),
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

