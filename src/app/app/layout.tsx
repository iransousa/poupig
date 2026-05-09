'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useMe } from '@/hooks/use-me';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const { data: me, isLoading, isFetching } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) router.replace('/');
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (isFetching) return;
    if (me && !me.onboarded) router.replace('/onboarding');
  }, [me, isFetching, router]);

  if (!ready || !authenticated || isLoading || (me && !me.onboarded)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-300">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-brand-400" />
          Carregando...
        </div>
      </div>
    );
  }

  return <div className="min-h-screen">{children}</div>;
}
