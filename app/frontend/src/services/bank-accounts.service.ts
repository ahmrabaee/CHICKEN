import axiosInstance from "@/lib/axios";

export interface BankAccount {
  id: number;
  code: string;
  name: string;
  nameEn?: string;
  accountId: number;
  account?: { id: number; code: string; name: string };
  companyId?: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountDto {
  code?: string;
  name: string;
  nameEn?: string;
  accountId: number;
  isDefault?: boolean;
}

export interface UpdateBankAccountDto {
  name?: string;
  nameEn?: string;
  accountId?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

export const bankAccountsService = {
  getAll: (includeInactive?: boolean) =>
    axiosInstance.get<{ data: BankAccount[] }>("/bank-accounts", {
      params: includeInactive ? { includeInactive: "true" } : undefined,
    }),

  getById: (id: number) =>
    axiosInstance.get<{ data: BankAccount }>(`/bank-accounts/${id}`),

  getDefault: () =>
    axiosInstance.get<{ data: BankAccount | null }>("/bank-accounts/default"),

  create: (dto: CreateBankAccountDto) =>
    axiosInstance.post<{ data: BankAccount }>("/bank-accounts", dto),

  update: (id: number, dto: UpdateBankAccountDto) =>
    axiosInstance.put<{ data: BankAccount }>(`/bank-accounts/${id}`, dto),

  delete: (id: number) =>
    axiosInstance.delete(`/bank-accounts/${id}`),
};
