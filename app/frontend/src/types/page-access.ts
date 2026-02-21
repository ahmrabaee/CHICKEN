/**
 * Page access types - per-user permissions
 */

export interface PageAccessItem {
  id: number;
  key: string;
  path: string;
  titleAr: string;
  titleEn?: string;
  groupKey?: string;
  sortOrder: number;
  allowed: boolean;
}

export interface PageAccessListResponse {
  pages: PageAccessItem[];
}

export interface AccountantUser {
  id: number;
  username: string;
  fullName: string;
  fullNameEn?: string;
  role: string;
}

export interface UpdatePageAccessDto {
  userId: number;
  pageKey: string;
  allowed: boolean;
}
