import { Module } from '@nestjs/common';
import { TaxTemplateService } from './tax-template.service';
import { TaxCalculationService } from './tax-calculation.service';
import { TaxEngineService } from './tax-engine.service';
import { VatReportService } from './vat-report.service';
import { TaxTemplateController } from './tax-template.controller';

@Module({
  controllers: [TaxTemplateController],
  providers: [TaxTemplateService, TaxCalculationService, TaxEngineService, VatReportService],
  exports: [TaxTemplateService, TaxCalculationService, TaxEngineService, VatReportService],
})
export class TaxModule {}
