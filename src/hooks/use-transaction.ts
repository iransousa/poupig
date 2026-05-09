'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

export type TransactionRow = {
  id: string;
  kind: 'onramp' | 'offramp';
  status: 'pending' | 'processing' | 'paid' | 'error' | 'expired';
  amountBrl: string | null;
  amountUsdc: string | null;
  pixCopiaECola: string | null;
  pixQrChave: string | null;
  receiverWallet: string | null;
  solanaSignature: string | null;
  errorMessage: string | null;
  createdAt: string;
  expiresAt: string | null;
  confirmedAt: string | null;
};

export function useTransaction(id: string | null) {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: () => apiFetch<TransactionRow>(`/api/transactions/${id}`),
    enabled: Boolean(id),
    refetchInterval: (q) => {
      const d = q.state.data as TransactionRow | undefined;
      if (!d) return 5000;
      // Para de pollar quando finaliza
      if (d.status === 'paid' || d.status === 'error' || d.status === 'expired') return false;
      // Polling adaptativo: começa rápido, desacelera após 30s
      const ageMs = Date.now() - new Date(d.createdAt).getTime();
      if (ageMs < 30_000) return 5000;
      if (ageMs < 5 * 60_000) return 10_000;
      return 30_000;
    },
    refetchOnWindowFocus: false,
  });
}
