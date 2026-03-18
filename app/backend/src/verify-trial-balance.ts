import { PdfService } from './pdf/pdf.service';
import { TrialBalancePdfData } from './pdf/pdf.types';
import * as fs from 'fs';
import * as path from 'path';

async function verifyTrialBalance() {
    const pdfService = new PdfService();

    const mockData: TrialBalancePdfData = {
        companyName: 'شركة الدجاج السعيد',
        reportTitle: 'Trial Balance',
        reportTitleAr: 'ميزان المراجعة',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        language: 'ar',
        currency: 'شيكل (₪)',
        generatedAt: new Date().toISOString(),
        appVersion: '2.5.0',
        isBalanced: true,
        totalOpeningDebit: 10000,
        totalOpeningCredit: 10000,
        totalPeriodDebit: 5000,
        totalPeriodCredit: 5000,
        totalEndingDebit: 15000,
        totalEndingCredit: 15000,
        rows: [
            {
                code: '1101',
                name: 'الصندوق',
                nameAr: 'الصندوق',
                openingDebit: 2000,
                openingCredit: 0,
                periodDebit: 3000,
                periodCredit: 1000,
                endingDebit: 4000,
                endingCredit: 0
            },
            {
                code: '1201',
                name: 'البنك',
                nameAr: 'البنك العربي',
                openingDebit: 8000,
                openingCredit: 0,
                periodDebit: 2000,
                periodCredit: 4000,
                endingDebit: 6000,
                endingCredit: 0
            },
            {
                code: '2101',
                name: 'رأس المال',
                nameAr: 'رأس المال',
                openingDebit: 0,
                openingCredit: 10000,
                periodDebit: 0,
                periodCredit: 0,
                endingDebit: 0,
                endingCredit: 10000
            }
        ]
    };

    try {
        console.log('Generating Trial Balance PDF...');
        const buffer = await pdfService.generate({
            meta: {
                title: mockData.reportTitle,
                storeName: mockData.companyName,
                generatedAt: mockData.generatedAt!,
                language: 'ar'
            },
            trialBalanceData: mockData
        });

        const outputPath = path.join(__dirname, 'test-trial-balance.pdf');
        fs.writeFileSync(outputPath, buffer);
        console.log(`PDF generated successfully at: ${outputPath}`);
    } catch (error) {
        console.error('Error generating PDF:', error);
    }
}

verifyTrialBalance();
