'use client';

import dynamic from 'next/dynamic';

const ClientProviders = dynamic(() => import('./client-providers').then((m) => m.ClientProviders), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center text-ink-300">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 animate-pulse rounded-full bg-brand-400" />
        Carregando...
      </div>
    </div>
  ),
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <ClientProviders>{children}</ClientProviders>;
}
