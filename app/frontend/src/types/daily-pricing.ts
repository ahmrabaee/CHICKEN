export interface DailyPriceItem {
  itemId: number;
  itemName: string;
  itemNameEn?: string;
  pricePerKg: number;
  defaultSalePrice: number;
}

export interface DailyPricingResponse {
  date: string;
  items: DailyPriceItem[];
  hasPrices: boolean;
}

export interface SetDailyPricingDto {
  date: string;
  prices: { itemId: number; pricePerKg: number }[];
}
