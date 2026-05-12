'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ArrowRight, Shield, TrendingUp, Zap } from 'lucide-react';
import { useMe } from '@/hooks/use-me';
import { Logo } from '@/components/logo';

export default function Home() {
  const { ready, authenticated, login } = usePrivy();
  const { data: me } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !authenticated) return;
    if (me) router.push(me.onboarded ? '/app' : '/onboarding');
  }, [ready, authenticated, me, router]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-12">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-accent/30 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-accent/15 blur-[100px]" />

      <div className="relative z-10 w-full max-w-md animate-slide-up space-y-8 text-center">
        <div className="flex items-center justify-center">
          <Logo size={88} withGlow />
        </div>

        <div className="space-y-3">
          <h1 className="text-h1 text-fg" style={{ fontSize: 40, lineHeight: 1.08 }}>
            Sua poupança
            <br />
            <span className="text-accent">em dólar</span>
          </h1>
          <p className="text-body text-fg-mid">
            Deposite via PIX, renda como dólar,
            <br />
            saque quando quiser.
          </p>
        </div>

        <div className="space-y-3">
          <button onClick={login} disabled={!ready} className="btn-primary group w-full">
            {ready ? (
              <>
                Começar agora
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            ) : (
              'Carregando...'
            )}
          </button>
          <p className="text-xs text-fg-dim">
            Sem taxas escondidas · Sem burocracia · Saque a qualquer hora
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4">
          <Feature icon={<Shield className="h-4 w-4" />} label="Seguro" sub="Non-custodial" />
          <Feature icon={<Zap className="h-4 w-4" />} label="Rápido" sub="PIX em 10s" />
          <Feature icon={<TrendingUp className="h-4 w-4" />} label="Rende" sub="Yield diário" />
        </div>

        <p className="pt-6 text-[11px] uppercase tracking-wider text-fg-dim">
          USDC · Solana · Kamino Finance
        </p>
      </div>
    </main>
  );
}

function Feature({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="rounded-[20px] bg-bg-1 p-3 ring-1 ring-line backdrop-blur">
      <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent">
        {icon}
      </div>
      <p className="text-xs font-semibold text-fg">{label}</p>
      <p className="text-[10px] text-fg-mid">{sub}</p>
    </div>
  );
}
