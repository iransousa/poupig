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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt=""
          width={56}
          height={56}
          className="animate-pulse-soft"
          style={{ filter: 'drop-shadow(0 8px 24px rgba(255, 61, 133, 0.5))' }}
        />
        <p className="text-[13px] text-fg-mid">Carregando...</p>
      </div>
    );
  }

  return <div className="min-h-screen">{children}</div>;
}
