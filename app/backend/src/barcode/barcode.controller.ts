import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BarcodeService } from './barcode.service';
import { BarcodeConfigDto } from './dto/barcode-config.dto';
import { Roles, RolesGuard } from '../common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('barcode')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('barcode')
export class BarcodeController {
  constructor(private readonly barcodeService: BarcodeService) {}

  @Get('config')
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'Get barcode configuration' })
  async getConfig() {
    return this.barcodeService.getConfig();
  }

  @Put('config')
  @Roles('admin')
  @ApiOperation({ summary: 'Update barcode configuration' })
  async updateConfig(@Body() dto: BarcodeConfigDto) {
    await this.barcodeService.updateConfig(dto);
    return this.barcodeService.getConfig();
  }

  @Get('parse')
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'Parse barcode and extract item code, weight, price' })
  async parse(@Query('barcode') barcode: string) {
    if (!barcode?.trim()) {
      return { error: 'Barcode is required' };
    }
    return this.barcodeService.parseBarcode(barcode.trim());
  }

  @Get('lookup')
  @Roles('admin', 'accountant')
  @ApiOperation({ summary: 'Lookup item by barcode (custom or static)' })
  async lookup(@Query('barcode') barcode: string) {
    if (!barcode?.trim()) {
      return { error: 'Barcode is required' };
    }
    return this.barcodeService.lookupByBarcode(barcode.trim());
  }
}
