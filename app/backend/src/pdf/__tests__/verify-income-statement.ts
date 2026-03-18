import { PdfService } from '../pdf.service';
import { PdfGenerateOptions } from '../pdf.types';
import * as fs from 'fs';
import * as path from 'path';

// Mock data matching the new IncomeStatementPdfData structure
const mockData = {
    companyName: 'مطعم وتشيكن هنيا',
    reportTitle: 'Income Statement',
    reportTitleAr: 'قائمة الدخل',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    sections: [
        {
            title: 'Revenue',
            titleAr: 'الإيرادات',
            rows: [
                { code: '4110', name: 'Sales Revenue', nameAr: 'مبيعات الوجبات', value: 15000000 },
                { code: '4200', name: 'Other Income', nameAr: 'إيرادات أخرى', value: 500000 },
            ],
            total: 15500000,
        },
        {
            title: 'Direct Costs (COGS)',
            titleAr: 'تكلفة البضاعة المباعة',
            rows: [
                { code: '5100', name: 'Cost of Goods Sold', nameAr: 'تكلفة المشتريات واللحوم', value: 8000000 },
            ],
            total: 8000000,
        },
        {
            title: 'Operating Expenses',
            titleAr: 'المصروفات التشغيلية',
            rows: [
                { code: '5400', name: 'Salaries', nameAr: 'رواتب وأجور', value: 3000000 },
                { code: '5410', name: 'Rent', nameAr: 'إيجارات', value: 1000000 },
                { code: '5420', name: 'Electricity', nameAr: 'كهرباء ومياه', value: 500000 },
            ],
            total: 4500000,
        },
    ],
    netIncomeLabel: 'Net Profit',
    netIncomeLabelAr: 'صافي الربح',
    netIncomeValue: 3000000,
    language: 'ar' as const,
    appVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    currency: '₪',
};

async function verify() {
    const pdfService = new PdfService();
    // Force init
    (pdfService as any).onModuleInit();

    const outDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    console.log('Generating Premium Income Statement PDF (Arabic)...');
    const options: PdfGenerateOptions = {
        meta: {
            title: 'Income Statement',
            titleAr: 'قائمة الدخل',
            storeName: 'مطعم وتشيكن هنيا',
            generatedAt: new Date().toISOString(),
            language: 'ar',
            taxNumber: '123456789',
            branchName: 'الفرع الرئيسي',
        },
        incomeStatementData: mockData,
    };

    const buffer = await pdfService.generate(options);
    fs.writeFileSync(path.join(outDir, 'income-statement-ar.pdf'), buffer);

    console.log('Generating Premium Income Statement PDF (English)...');
    const optionsEn: PdfGenerateOptions = {
        ...options,
        meta: { ...options.meta, language: 'en' },
        incomeStatementData: { ...mockData, language: 'en' },
    };
    const bufferEn = await pdfService.generate(optionsEn);
    fs.writeFileSync(path.join(outDir, 'income-statement-en.pdf'), bufferEn);

    console.log('Verification Complete. Check src/pdf/__tests__/test-output/');
}

verify().catch(console.error);
