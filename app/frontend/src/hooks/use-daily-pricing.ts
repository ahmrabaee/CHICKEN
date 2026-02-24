import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dailyPricingService } from '@/services/daily-pricing.service';
import type { SetDailyPricingDto } from '@/types/daily-pricing';

/** Format minor units to major for display */
function toMajor(units: number): string {
  return (units / 100).toFixed(2);
}

/** Parse display value to minor units */
function toMinor(value: string | number): number {
  const n = typeof value === 'string' ? parseFloat(value) || 0 : value;
  return Math.round(n * 100);
}

export function useDailyPricing(date?: string) {
  const dateStr = date || new Date().toISOString().split('T')[0];
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['daily-pricing', dateStr],
    queryFn: () => dailyPricingService.getByDate(dateStr),
  });

  const yesterdayQuery = useQuery({
    queryKey: ['daily-pricing', 'yesterday'],
    queryFn: () => dailyPricingService.getYesterday(),
  });

  const setPricingMutation = useMutation({
    mutationFn: (dto: SetDailyPricingDto) =>
      dailyPricingService.setPricing(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-pricing'] });
    },
  });

  const copyFromYesterdayMutation = useMutation({
    mutationFn: (targetDate?: string) =>
      dailyPricingService.copyFromYesterday(targetDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-pricing'] });
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    yesterdayHasPrices: yesterdayQuery.data?.hasPrices ?? false,
    setPricing: setPricingMutation.mutateAsync,
    setPricingLoading: setPricingMutation.isPending,
    copyFromYesterday: copyFromYesterdayMutation.mutateAsync,
    copyFromYesterdayLoading: copyFromYesterdayMutation.isPending,
    toMajor,
    toMinor,
  };
}
