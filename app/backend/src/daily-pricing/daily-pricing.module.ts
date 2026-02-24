import { Module } from '@nestjs/common';
import { DailyPricingController } from './daily-pricing.controller';
import { DailyPricingService } from './daily-pricing.service';

@Module({
  controllers: [DailyPricingController],
  providers: [DailyPricingService],
  exports: [DailyPricingService],
})
export class DailyPricingModule {}
