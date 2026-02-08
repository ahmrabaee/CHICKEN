import { Module } from '@nestjs/common';
import { WastageController } from './wastage.controller';
import { WastageService } from './wastage.service';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  controllers: [WastageController],
  providers: [WastageService],
  exports: [WastageService],
})
export class WastageModule {}
