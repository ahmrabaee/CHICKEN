import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { InventoryModule } from '../inventory/inventory.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [InventoryModule, PdfModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
