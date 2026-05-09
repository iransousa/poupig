'use client';

import { useQuery } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { apiFetch } from '@/lib/api/client';

export type YieldSeries = { date: string; brl: number; usdc: number };

export type YieldData = {
  currentBrl: number;
  currentUsdc: number;
  principalUsdc: number;
  apy: number;
  yieldTodayBRL: number;
  yieldTodayUSDC: number;
  yieldMonthBRL: number;
  yieldMonthUSDC: number;
  yieldTotalUSDC: number;
  series: YieldSeries[];
};

export function useYield() {
  const { ready, authenticated } = usePrivy();
  return useQuery({
    queryKey: ['yield'],
    queryFn: () => apiFetch<YieldData>('/api/yield'),
    enabled: ready && authenticated,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
