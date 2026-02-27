import axiosInstance from '@/lib/axios';

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
  price?: number;
  totalPriceWithTax?: number;
  rawBarcode: string;
}

export const barcodeService = {
  async getConfig(): Promise<BarcodeConfig> {
    const response = await axiosInstance.get<{ success: boolean; data: BarcodeConfig }>('/barcode/config');
    return (response.data?.data ?? response.data) as BarcodeConfig;
  },

  async updateConfig(config: Partial<BarcodeConfig>): Promise<BarcodeConfig> {
    const response = await axiosInstance.put<{ success: boolean; data: BarcodeConfig }>('/barcode/config', config);
    return (response.data?.data ?? response.data) as BarcodeConfig;
  },

  async parse(barcode: string): Promise<BarcodeParseResult> {
    const response = await axiosInstance.get<{ success: boolean; data: BarcodeParseResult }>('/barcode/parse', {
      params: { barcode },
    });
    return (response.data?.data ?? response.data) as BarcodeParseResult;
  },

  async lookup(barcode: string): Promise<{ item: any; weightKg?: number; price?: number }> {
    const response = await axiosInstance.get<{ success: boolean; data: { item: any; weightKg?: number; price?: number } }>(
      '/barcode/lookup',
      { params: { barcode } }
    );
    return (response.data?.data ?? response.data) as { item: any; weightKg?: number; price?: number };
  },
};
