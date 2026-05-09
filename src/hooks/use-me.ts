'use client';

import { useQuery } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { apiFetch } from '@/lib/api/client';

export type Me = {
  id?: string;
  privyUserId?: string;
  email: string | null;
  phone?: string | null;
  fullName?: string | null;
  role?: 'customer' | 'admin' | 'support';
  solanaWalletAddress: string | null;
  onboarded: boolean;
};

export function useMe() {
  const { ready, authenticated } = usePrivy();
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<Me>('/api/users/me'),
    enabled: ready && authenticated,
    staleTime: 30_000,
  });
}
