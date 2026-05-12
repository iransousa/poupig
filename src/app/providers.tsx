'use client';

import dynamic from 'next/dynamic';

const ClientProviders = dynamic(() => import('./client-providers').then((m) => m.ClientProviders), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt=""
        width={64}
        height={64}
        className="animate-pulse-soft"
        style={{ filter: 'drop-shadow(0 8px 24px rgba(255, 61, 133, 0.5))' }}
      />
    </div>
  ),
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <ClientProviders>{children}</ClientProviders>;
}
