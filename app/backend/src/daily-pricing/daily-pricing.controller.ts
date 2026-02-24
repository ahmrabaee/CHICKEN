import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DailyPricingService } from './daily-pricing.service';
import {
  SetDailyPricingDto,
  CopyFromYesterdayDto,
  DailyPricingResponseDto,
} from './dto/daily-pricing.dto';
import { CurrentUser } from '../common';

@ApiTags('daily-pricing')
@ApiBearerAuth('JWT-auth')
@Controller('daily-pricing')
export class DailyPricingController {
  constructor(private readonly dailyPricingService: DailyPricingService) {}

  @Get()
  @ApiOperation({ summary: 'Get daily prices for a date' })
  @ApiResponse({ status: 200, description: 'Daily pricing for the date' })
  async getByDate(
    @Query('date') date: string,
    @Query('branchId') branchId?: string,
  ) {
    const dateStr = date || new Date().toISOString().split('T')[0];
    const branch = branchId ? parseInt(branchId, 10) : null;
    return this.dailyPricingService.getByDate(dateStr, branch);
  }

  @Get('yesterday')
  @ApiOperation({ summary: 'Get yesterday\'s prices' })
  @ApiResponse({ status: 200, description: 'Yesterday\'s pricing' })
  async getYesterday(@Query('branchId') branchId?: string) {
    const branch = branchId ? parseInt(branchId, 10) : null;
    return this.dailyPricingService.getYesterday(branch);
  }

  @Post()
  @ApiOperation({ summary: 'Save daily prices' })
  @ApiResponse({ status: 200, description: 'Prices saved', type: DailyPricingResponseDto })
  async setPricing(
    @Body() dto: SetDailyPricingDto,
    @CurrentUser() user: { id: number },
    @Query('branchId') branchId?: string,
  ) {
    const branch = branchId ? parseInt(branchId, 10) : null;
    return this.dailyPricingService.setPricing(
      dto.date,
      dto.prices,
      branch,
      user.id,
    );
  }

  @Post('copy-from-yesterday')
  @ApiOperation({ summary: 'Copy yesterday\'s prices to today' })
  @ApiResponse({ status: 200, description: 'Prices copied' })
  async copyFromYesterday(
    @Body() dto: CopyFromYesterdayDto,
    @CurrentUser() user: { id: number },
    @Query('branchId') branchId?: string,
  ) {
    const branch = branchId ? parseInt(branchId, 10) : null;
    return this.dailyPricingService.copyFromYesterday(
      dto.date,
      branch,
      user.id,
    );
  }
}
