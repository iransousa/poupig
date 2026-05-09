'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

export type KaminoConfigPublic = {
  env: 'mock' | 'staging' | 'devnet' | 'mainnet';
  cluster: 'mainnet-beta' | 'devnet';
  programId: string;
  mainMarket: string;
  usdcMint: string;
  explorerBase: string;
};

export function useKaminoConfig() {
  return useQuery({
    queryKey: ['kamino-config'],
    queryFn: () => apiFetch<KaminoConfigPublic>('/api/kamino/config'),
    staleTime: Infinity,
  });
}

export type Preflight = {
  env: string;
  cluster?: string;
  solLamports: number;
  usdcAmount: number;
  hasSol: boolean;
  hasUsdc: boolean;
  minSolRecommended: number;
};

export function useKaminoPreflight(enabled = true) {
  return useQuery({
    queryKey: ['kamino-preflight'],
    queryFn: () => apiFetch<Preflight>('/api/kamino/preflight'),
    enabled,
    refetchInterval: 15_000,
  });
}
