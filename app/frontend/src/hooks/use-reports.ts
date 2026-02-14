
import { useQuery } from '@tanstack/react-query';
import { reportService } from '@/services/report.service';
import { DateRangeQuery } from '@/types/reports';

export const useDashboard = () => {
    return useQuery({
        queryKey: ['reports', 'dashboard'],
        queryFn: () => reportService.getDashboard(),
    });
};

export const useSalesReport = (params: DateRangeQuery) => {
    return useQuery({
        queryKey: ['reports', 'sales', params],
        queryFn: () => reportService.getSalesReport(params),
        enabled: !!params.startDate && !!params.endDate,
    });
};

export const usePurchasesReport = (params: DateRangeQuery) => {
    return useQuery({
        queryKey: ['reports', 'purchases', params],
        queryFn: () => reportService.getPurchasesReport(params),
        enabled: !!params.startDate && !!params.endDate,
    });
};

export const useInventoryReport = () => {
    return useQuery({
        queryKey: ['reports', 'inventory'],
        queryFn: () => reportService.getInventoryReport(),
    });
};

export const useWastageReport = (params: DateRangeQuery) => {
    return useQuery({
        queryKey: ['reports', 'wastage', params],
        queryFn: () => reportService.getWastageReport(params),
        enabled: !!params.startDate && !!params.endDate,
    });
};

export const useExpenseReport = (params: DateRangeQuery) => {
    return useQuery({
        queryKey: ['reports', 'expenses', params],
        queryFn: () => reportService.getExpenseReport(params),
        enabled: !!params.startDate && !!params.endDate,
    });
};

export const useProfitLossReport = (params: DateRangeQuery) => {
    return useQuery({
        queryKey: ['reports', 'profit-loss', params],
        queryFn: () => reportService.getProfitLossReport(params),
        enabled: !!params.startDate && !!params.endDate,
    });
};

export const useStockVsGLReport = (params?: { asOfDate?: string; branchId?: number }) => {
    return useQuery({
        queryKey: ['reports', 'stock-vs-gl', params],
        queryFn: () => reportService.getStockVsGLReport(params),
    });
};
