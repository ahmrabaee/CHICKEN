import { PdfService } from '../pdf.service';
import { PdfGenerateOptions } from '../pdf.types';
import * as fs from 'fs';
import * as path from 'path';

// Mock data
const mockMeta = {
    title: 'Test Document',
    titleAr: 'مستند تجريبي',
    storeName: 'Chicken Shop',
    taxNumber: '300012345600003',
    generatedBy: 'Admin',
    generatedAt: new Date().toISOString().split('T')[0],
    language: 'ar' as 'ar' | 'en',
    branchName: 'Main Branch'
};

async function verify() {
    const pdfService = new PdfService();
    // Force init (normally done by NestJS)
    (pdfService as any).onModuleInit();

    const outDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    console.log('Generating Simple Text PDF...');
    const simpleOptions: PdfGenerateOptions = {
        meta: { ...mockMeta, title: 'Simple Test', titleAr: 'اختبار بسيط' },
        pageOrientation: 'portrait',
        // No columns/rows, just title/header/footer from service
    };
    const simpleBuffer = await pdfService.generate(simpleOptions);
    fs.writeFileSync(path.join(outDir, 'simple-ar.pdf'), simpleBuffer);

    console.log('Generating Sale Invoice...');
    const invoiceOptions: PdfGenerateOptions = {
        meta: { ...mockMeta, title: 'Tax Invoice', titleAr: 'فاتورة ضريبية' },
        columns: [
            { header: 'Item', headerAr: 'الصنف', field: 'name', width: '*' },
            { header: 'Qty', headerAr: 'الكمية', field: 'qty', width: 'auto' },
            { header: 'Price', headerAr: 'السعر', field: 'price', width: 'auto', format: 'currency' },
            { header: 'Total', headerAr: 'الإجمالي', field: 'total', width: 'auto', format: 'currency' }
        ],
        rows: [
            { name: 'Frozen Chicken', qty: 10, price: 15.50, total: 155.00 },
            { name: 'Spicy Strips / ستربس حار', qty: 2, price: 25.00, total: 50.00 },
        ],
        summaryItems: [
            { label: 'Total', labelAr: 'الإجمالي', value: 205.00, format: 'currency', bold: true }
        ]
    };
    const invoiceBuffer = await pdfService.generate(invoiceOptions);
    fs.writeFileSync(path.join(outDir, 'invoice-ar.pdf'), invoiceBuffer);

    console.log('Generating Financial Statement (BS)...');
    const bsOptions: PdfGenerateOptions = {
        meta: { ...mockMeta, title: 'Balance Sheet', titleAr: 'الميزانية العمومية' },
        sections: [
            {
                title: 'Assets',
                titleAr: 'الأصول',
                items: [
                    { label: 'Cash', labelAr: 'النقدية', value: 50000 },
                    { label: 'Inventory', labelAr: 'المخزون', value: 120000 },
                ],
                total: 170000
            },
            {
                title: 'Liabilities',
                titleAr: 'الخصوم',
                items: [
                    { label: 'Accounts Payable', labelAr: 'الدائنون', value: 30000 },
                ],
                total: 30000
            }
        ],
        grandTotal: {
            label: 'Net Assets',
            labelAr: 'صافي الأصول',
            value: 140000
        }
    };
    const bsBuffer = await pdfService.generate(bsOptions);
    fs.writeFileSync(path.join(outDir, 'balance-sheet-ar.pdf'), bsBuffer);

    console.log('Verification Complete. Check src/pdf/__tests__/test-output/');
}

verify().catch(console.error);
