'use client';

import { useQuery } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { apiFetch } from '@/lib/api/client';

export type WalletBalance = {
  wallet: string;
  sol: number;
  solLamports: number;
  usdc: number;
  cluster: 'mainnet-beta' | 'devnet';
  env: string;
  error?: string;
};

export function useWalletBalance() {
  const { ready, authenticated } = usePrivy();
  return useQuery({
    queryKey: ['wallet-balance'],
    queryFn: () => apiFetch<WalletBalance>('/api/wallet/balance'),
    enabled: ready && authenticated,
    refetchInterval: 20_000,
    staleTime: 10_000,
    retry: 1,
  });
}
