'use client';

import { useQuery } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { apiFetch } from '@/lib/api/client';

export type Balance = {
  usdc: number;
  usdcSupplied: number;
  brl: number;
  usdcBrlRate: number;
  apy: number;
  hasPosition: boolean;
};

export function useBalance() {
  const { ready, authenticated } = usePrivy();
  return useQuery({
    queryKey: ['balance'],
    queryFn: () => apiFetch<Balance>('/api/balance'),
    enabled: ready && authenticated,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
