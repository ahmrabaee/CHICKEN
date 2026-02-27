/**
 * Custom Barcode System - Types
 * 25-digit format: 1 start + 6 item + 5 weight + 7 totalPrice + 5 price + 1 check
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
