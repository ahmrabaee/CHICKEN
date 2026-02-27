import { Module } from '@nestjs/common';
import { BarcodeController } from './barcode.controller';
import { BarcodeService } from './barcode.service';
import { SettingsModule } from '../settings/settings.module';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [SettingsModule, ItemsModule],
  controllers: [BarcodeController],
  providers: [BarcodeService],
  exports: [BarcodeService],
})
export class BarcodeModule {}
