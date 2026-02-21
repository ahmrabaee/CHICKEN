import axiosInstance from '@/lib/axios';
import type {
  PageAccessListResponse,
  AccountantUser,
  UpdatePageAccessDto,
} from '@/types/page-access';
import type { ApiResponse } from '@/types/api';

/**
 * Page Access API Service
 * Per-user page permissions (each accountant has their own)
 */
export const pageAccessService = {
  /**
   * Get accountant users for the selector
   * GET /v1/page-access/users
   */
  async getAccountantUsers(): Promise<AccountantUser[]> {
    const response = await axiosInstance.get<
      ApiResponse<AccountantUser[]>
    >('/page-access/users');
    return response.data.data;
  },

  /**
   * Get page access for a specific user
   * GET /v1/page-access/user/:userId
   */
  async getByUserId(userId: number): Promise<PageAccessListResponse> {
    const response = await axiosInstance.get<
      ApiResponse<PageAccessListResponse>
    >(`/page-access/user/${userId}`);
    return response.data.data;
  },

  /**
   * Update single page access for a user
   * PUT /v1/page-access
   */
  async update(dto: UpdatePageAccessDto): Promise<{ success: boolean }> {
    const response = await axiosInstance.put<
      ApiResponse<{ success: boolean }>
    >('/page-access', dto);
    return response.data.data;
  },

  /**
   * Bulk update page access
   * PUT /v1/page-access/bulk
   */
  async bulkUpdate(items: UpdatePageAccessDto[]): Promise<{ success: boolean }> {
    const response = await axiosInstance.put<
      ApiResponse<{ success: boolean }>
    >('/page-access/bulk', { items });
    return response.data.data;
  },
};
