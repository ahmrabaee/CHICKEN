import { Module } from '@nestjs/common';
import { ChartOfAccountsModule } from '../chart-of-accounts/chart-of-accounts.module';
import { GlEngineService } from './gl-engine.service';
import { GlValidatorService } from './gl-validator.service';
import { GlRoundingService } from './gl-rounding.service';
import { GlMergerService } from './gl-merger.service';
import { GlEntryFactory } from './gl-entry.factory';

@Module({
  imports: [ChartOfAccountsModule],
  providers: [GlEngineService, GlValidatorService, GlRoundingService, GlMergerService, GlEntryFactory],
  exports: [GlEngineService],
})
export class GlEngineModule {}
