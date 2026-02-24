import axiosInstance from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
  DailyPricingResponse,
  SetDailyPricingDto,
} from '@/types/daily-pricing';

export const dailyPricingService = {
  async getByDate(date?: string): Promise<DailyPricingResponse> {
    const dateStr = date || new Date().toISOString().split('T')[0];
    const response = await axiosInstance.get<ApiResponse<DailyPricingResponse>>(
      '/daily-pricing',
      { params: { date: dateStr } }
    );
    return response.data.data;
  },

  async getYesterday(): Promise<DailyPricingResponse> {
    const response = await axiosInstance.get<ApiResponse<DailyPricingResponse>>(
      '/daily-pricing/yesterday'
    );
    return response.data.data;
  },

  async setPricing(dto: SetDailyPricingDto): Promise<DailyPricingResponse> {
    const response = await axiosInstance.post<
      ApiResponse<DailyPricingResponse>
    >('/daily-pricing', dto);
    return response.data.data;
  },

  async copyFromYesterday(date?: string): Promise<DailyPricingResponse> {
    const dateStr = date || new Date().toISOString().split('T')[0];
    const response = await axiosInstance.post<
      ApiResponse<DailyPricingResponse>
    >('/daily-pricing/copy-from-yesterday', { date: dateStr });
    return response.data.data;
  },
};
