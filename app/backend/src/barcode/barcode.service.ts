import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { ItemsService } from '../items/items.service';
import type { BarcodeConfig, BarcodeParseResult } from './barcode.types';

@Injectable()
export class BarcodeService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly itemsService: ItemsService,
  ) {}

  async getConfig(): Promise<BarcodeConfig> {
    const group = await this.settingsService.getByGroup('barcode');
    return {
      customEnabled: group['barcode.custom_enabled'] ?? true,
      // Template: [StartCode(1)] [ItemCode(6)] [TotalPriceWithTax(7)] = 14 digits
      totalLength: group['barcode.total_length'] ?? 14,
      itemCodeStart: group['barcode.item_code_start'] ?? 1,
      itemCodeLength: group['barcode.item_code_length'] ?? 6,
      // Weight field not present in this template — set length to 0
      weightStart: group['barcode.weight_start'] ?? 7,
      weightLength: group['barcode.weight_length'] ?? 0,
      // Total price occupies positions 7–13
      totalPriceStart: group['barcode.total_price_start'] ?? 7,
      totalPriceLength: group['barcode.total_price_length'] ?? 7,
      // Unit price field not present
      priceStart: group['barcode.price_start'] ?? 0,
      priceLength: group['barcode.price_length'] ?? 0,
    };
  }

  async updateConfig(config: Partial<BarcodeConfig>): Promise<void> {
    const mapping: Record<string, string> = {
      customEnabled: 'barcode.custom_enabled',
      totalLength: 'barcode.total_length',
      itemCodeStart: 'barcode.item_code_start',
      itemCodeLength: 'barcode.item_code_length',
      weightStart: 'barcode.weight_start',
      weightLength: 'barcode.weight_length',
      totalPriceStart: 'barcode.total_price_start',
      totalPriceLength: 'barcode.total_price_length',
      priceStart: 'barcode.price_start',
      priceLength: 'barcode.price_length',
    };
    for (const [key, settingKey] of Object.entries(mapping)) {
      const val = (config as any)[key];
      if (val !== undefined) {
        await this.settingsService.set(settingKey, val);
      }
    }
  }

  /**
   * Parse custom 25-digit barcode.
   * Format: [1 start][6 item][5 weight grams][7 totalPrice][5 price][1 check]
   */
  async parseBarcode(barcode: string): Promise<BarcodeParseResult> {
    const config = await this.getConfig();

    if (!config.customEnabled) {
      throw new BadRequestException({
        code: 'BARCODE_CUSTOM_DISABLED',
        message: 'Custom barcode is disabled',
        messageAr: 'الباركود المخصص غير مفعّل',
      });
    }

    const cleaned = barcode.replace(/\D/g, '');
    if (cleaned.length !== config.totalLength) {
      throw new BadRequestException({
        code: 'BARCODE_INVALID_LENGTH',
        message: `Barcode must be exactly ${config.totalLength} digits`,
        messageAr: `الباركود يجب أن يكون ${config.totalLength} رقم بالضبط`,
      });
    }

    const itemCode = cleaned.substring(
      config.itemCodeStart,
      config.itemCodeStart + config.itemCodeLength,
    );
    const weightStr = cleaned.substring(
      config.weightStart,
      config.weightStart + config.weightLength,
    );
    const totalPriceStr = cleaned.substring(
      config.totalPriceStart,
      config.totalPriceStart + config.totalPriceLength,
    );
    const priceStr = cleaned.substring(
      config.priceStart,
      config.priceStart + config.priceLength,
    );

    const weightGrams = parseInt(weightStr, 10) || 0;
    const weightKg = weightGrams / 1000;
    const totalPriceWithTax = parseInt(totalPriceStr, 10) || 0;
    const price = parseInt(priceStr, 10) || 0;

    return {
      itemCode,
      weightKg: weightKg > 0 ? Math.round(weightKg * 1000) / 1000 : undefined,
      weightGrams: weightGrams > 0 ? weightGrams : undefined,
      price: price > 0 ? price : undefined,
      totalPriceWithTax: totalPriceWithTax > 0 ? totalPriceWithTax : undefined,
      rawBarcode: barcode,
    };
  }

  /**
   * Check if barcode looks like custom format (25 digits) without full parse.
   */
  async isCustomFormat(barcode: string): Promise<boolean> {
    const config = await this.getConfig();
    if (!config.customEnabled) return false;
    const cleaned = barcode.replace(/\D/g, '');
    return cleaned.length === config.totalLength;
  }

  /**
   * Lookup item by barcode. Supports custom 14-digit scale format and static barcode.
   *
   * Scale template: [1 start][6 item][7 totalPrice]
   * - No weight field: weight is INFERRED from (totalPriceMinor / pricePerKg).
   * - price = total line price in minor units.
   */
  async lookupByBarcode(barcode: string): Promise<{
    item: any;
    weightKg?: number;
    price?: number;
  }> {
    const config = await this.getConfig();
    const cleaned = barcode.replace(/\D/g, '');

    if (config.customEnabled && cleaned.length === config.totalLength) {
      const parsed = await this.parseBarcode(barcode);
      const item = await this.itemsService.findByCode(parsed.itemCode);

      // Template provides total price, not weight — infer weight from total/pricePerKg
      const totalMinor = parsed.totalPriceWithTax ?? parsed.price ?? 0;
      const pricePerKgMinor = item.defaultSalePrice ?? 0;

      let weightKg: number;
      if (parsed.weightKg && parsed.weightKg > 0) {
        // Weight was encoded in barcode (older template)
        weightKg = parsed.weightKg;
      } else if (pricePerKgMinor > 0 && totalMinor > 0) {
        // Infer weight: round to 3 decimal places, tolerance ≤1 minor unit
        weightKg = Math.round((totalMinor / pricePerKgMinor) * 1000) / 1000;
      } else {
        weightKg = 1;
      }

      const price = totalMinor > 0 ? totalMinor : Math.round(pricePerKgMinor * weightKg);
      return { item, weightKg, price };
    }

    // Fallback: static barcode lookup
    const item = await this.itemsService.findByBarcode(barcode);
    const defPrice = item.defaultSalePrice ?? 0;
    return {
      item,
      weightKg: 1,
      price: defPrice,
    };
  }
}
