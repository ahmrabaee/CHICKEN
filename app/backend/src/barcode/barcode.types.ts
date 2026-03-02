/**
 * Custom Barcode System - Types
 * Scale template: [1 start='2'] [6 item code] [7 total price minor] = 14 digits
 * Weight is NOT encoded in this template; inferred from (totalPrice / pricePerKg).
 */

export interface BarcodeConfig {
  customEnabled: boolean;
  totalLength: number;
  itemCodeStart: number;
  itemCodeLength: number;
  weightStart: number;
  weightLength: number;
  totalPriceStart: number;
  totalPriceLength: number;
  priceStart: number;
  priceLength: number;
}

export interface BarcodeParseResult {
  itemCode: string;
  weightKg?: number;
  weightGrams?: number;
  price?: number; // minor units
  totalPriceWithTax?: number; // minor units
  rawBarcode: string;
}
