'use client';

import { useQuery } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { apiFetch } from '@/lib/api/client';
import { useMe } from './use-me';

export type AdminMetrics = {
  users: {
    total: number;
    onboarded: number;
    newLast7: number;
    newLast30: number;
    activeWithPosition: number;
  };
  tvl: {
    usdc: number;
    brl: number;
    principalUsdc: number;
    yieldUsdc: number;
    rate: number;
    avgApy: number;
  };
  volume7d: {
    depositsBrl: number;
    withdrawsBrl: number;
    failures: number;
    pending: number;
  };
  volume30d: {
    depositsBrl: number;
    withdrawsBrl: number;
  };
  generatedAt: string;
};

export type TvlPoint = { date: string; tvlUsdc: number; tvlBrl: number; users: number };

export function useAdminMetrics() {
  const { ready, authenticated } = usePrivy();
  return useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => apiFetch<AdminMetrics>('/api/admin/metrics'),
    enabled: ready && authenticated,
    refetchInterval: 30_000,
  });
}

export function useTvlSeries(days = 30) {
  const { ready, authenticated } = usePrivy();
  return useQuery({
    queryKey: ['admin-tvl-series', days],
    queryFn: () => apiFetch<{ series: TvlPoint[] }>(`/api/admin/metrics/tvl-series?days=${days}`),
    enabled: ready && authenticated,
  });
}

export type AdminCustomer = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: 'customer' | 'admin' | 'support';
  solanaWallet: string | null;
  onboardedAt: string | null;
  disabledAt: string | null;
  createdAt: string;
  usdcSupplied: number;
  usdcCurrentValue: number;
};

export function useAdminCustomers(params: { q?: string; status?: string; limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  return useQuery({
    queryKey: ['admin-customers', params],
    queryFn: () =>
      apiFetch<{ items: AdminCustomer[]; total: number; limit: number; offset: number }>(
        `/api/admin/customers?${qs.toString()}`,
      ),
  });
}

export function useAdminCustomer(id: string | null) {
  return useQuery({
    queryKey: ['admin-customer', id],
    queryFn: () => apiFetch(`/api/admin/customers/${id}`),
    enabled: !!id,
  });
}

export function useAdminGuard() {
  const { data: me, isLoading } = useMe();
  const meRole = (me as unknown as { role?: string })?.role;
  const isAdmin = meRole === 'admin' || meRole === 'support';
  return { isAdmin, role: meRole, isLoading };
}
