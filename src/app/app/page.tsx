'use client';

import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, History, LogOut, Send, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { useMe } from '@/hooks/use-me';
import { useBalance } from '@/hooks/use-balance';
import { useYield } from '@/hooks/use-yield';
import { useWalletBalance } from '@/hooks/use-wallet-balance';
import { formatBRL, formatPct, formatUSD, greeting } from '@/lib/utils';
import { YieldChart } from '@/components/yield-chart';
import { EnvBadge } from '@/components/env-badge';
import { PreflightBanner } from '@/components/preflight-banner';
import { apiFetch } from '@/lib/api/client';
import { useQueryClient } from '@tanstack/react-query';

const IS_MOCK = process.env.NEXT_PUBLIC_FOUR_P_DRIVER === 'mock';

export default function Dashboard() {
  const { logout } = usePrivy();
  const { data: me } = useMe();
  const { data: balance } = useBalance();
  const { data: yieldData } = useYield();
  const { data: walletBalance } = useWalletBalance();
  const qc = useQueryClient();

  const apy = yieldData?.apy ?? balance?.apy ?? 0;
  const currentUsdc = yieldData?.currentUsdc ?? balance?.usdc ?? 0;
  const currentBrl = yieldData?.currentBrl ?? balance?.brl ?? 0;
  const yieldUSDC = Math.max((balance?.usdc ?? 0) - (balance?.usdcSupplied ?? 0), 0);

  async function takeSnapshot() {
    try {
      const res = await apiFetch<{ processed: number }>('/api/cron/daily-snapshot');
      toast.success(`Snapshot gravado (${res.processed} users)`);
      await qc.invalidateQueries({ queryKey: ['yield'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <main className="mx-auto max-w-lg px-5 pb-16 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[13px] text-fg-mid">
              {greeting()}, {me?.fullName?.split(' ')[0] ?? me?.email ?? 'user'}
            </p>
            <EnvBadge />
          </div>
          <p className="text-h3 text-fg">Seu saldo</p>
        </div>
        <button
          onClick={logout}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-2 text-fg-mid ring-1 ring-line transition hover:bg-bg-3"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <PreflightBanner />

      {/* Hero card — rosa neon, fundo do design system */}
      <section className="card-hero animate-slide-up">
        <p className="relative z-10 text-[13px] font-medium text-black/65">Seu saldo em dólar</p>
        <p className="relative z-10 mt-1.5 text-display tracking-tight text-black">
          {formatUSD(currentUsdc)}
        </p>
        <div className="relative z-10 mt-1 flex items-center gap-2 text-[13px] text-black/70">
          <span>{formatBRL(currentBrl)}</span>
          {yieldUSDC > 0 && (
            <>
              <span className="text-black/40">·</span>
              <span className="inline-flex items-center gap-1 font-medium">
                <ArrowUp className="h-3 w-3" />+ {formatUSD(yieldUSDC, 2)}
              </span>
            </>
          )}
        </div>

        <div className="relative z-10 mt-6 grid grid-cols-3 gap-2">
          <HeroAction href="/app/deposit" label="Depositar" icon={<ArrowDown />} />
          <HeroAction href="/app/withdraw" label="Sacar" icon={<ArrowUp />} />
          <HeroAction href="/app/history" label="Histórico" icon={<Send />} />
        </div>
      </section>

      {/* Yield chart */}
      <section className="card mt-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-fg-dim">Rendimento</p>
            <p className="text-h3 text-fg">{formatUSD(yieldUSDC, 2)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-fg-dim">APY atual</p>
            <p className="text-h3 text-accent">{apy ? formatPct(apy) : '—'}</p>
          </div>
        </div>
        <YieldChart series={yieldData?.series ?? []} />
      </section>

      {/* Wallet balance on-chain */}
      <section className="mt-3 rounded-[20px] bg-bg-1 p-4 ring-1 ring-line">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-bg-3 text-fg-mid">
              <Wallet className="h-3.5 w-3.5" />
            </div>
            <p className="text-[13px] font-medium text-fg">Saldo da carteira</p>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-fg-dim">on-chain</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] text-fg-dim">USDC</p>
            <p className="text-h3 text-fg">{(walletBalance?.usdc ?? 0).toFixed(4)}</p>
          </div>
          <div>
            <p className="text-[11px] text-fg-dim">SOL</p>
            <p className="text-h3 text-fg">{(walletBalance?.sol ?? 0).toFixed(4)}</p>
          </div>
        </div>
        {walletBalance && walletBalance.usdc > 0.01 && (
          <a
            href="/app/deposit"
            className="mt-3 block rounded-full bg-accent-soft px-3 py-2 text-center text-[12px] font-medium text-accent ring-1 ring-accent/30 transition hover:bg-accent/15"
          >
            ✨ Aplicar {(walletBalance.usdc).toFixed(2)} USDC no Kamino
          </a>
        )}
      </section>

      {/* KPIs */}
      <section className="mt-3 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-fg-dim">
            <TrendingUp className="h-3.5 w-3.5" />
            <p className="text-[11px] uppercase tracking-wider">Hoje</p>
          </div>
          <p className="mt-1 text-h3 text-positive">+ {formatBRL(yieldData?.yieldTodayBRL ?? 0)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-fg-dim">
            <TrendingUp className="h-3.5 w-3.5" />
            <p className="text-[11px] uppercase tracking-wider">No mês</p>
          </div>
          <p className="mt-1 text-h3 text-positive">+ {formatBRL(yieldData?.yieldMonthBRL ?? 0)}</p>
        </div>
      </section>

      {/* List row — histórico */}
      <a
        href="/app/history"
        className="mt-3 flex w-full items-center justify-between rounded-[20px] bg-bg-1 p-4 ring-1 ring-line transition hover:bg-bg-2"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-bg-3 text-fg-mid">
            <History className="h-4 w-4" />
          </div>
          <span className="text-[15px] font-medium text-fg">Histórico de transações</span>
        </div>
        <span className="text-fg-dim">→</span>
      </a>

      {/* Admin link */}
      {(me?.role === 'admin' || me?.role === 'support') && (
        <a
          href="/admin"
          className="mt-2 flex w-full items-center justify-between rounded-[20px] bg-accent-soft p-4 ring-1 ring-accent/30 transition hover:bg-accent/15"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[15px] font-medium text-accent">Painel administrativo</p>
              <p className="text-[11px] text-accent/70">Role: {me.role}</p>
            </div>
          </div>
          <span className="text-accent">→</span>
        </a>
      )}

      {IS_MOCK && (
        <button
          onClick={takeSnapshot}
          className="mt-3 w-full rounded-full border border-dashed border-warning/30 bg-warning/5 px-4 py-2 text-[12px] font-medium text-warning hover:bg-warning/10"
        >
          🧪 Tirar snapshot agora · mock
        </button>
      )}

      {me?.solanaWalletAddress && (
        <p className="mt-6 break-all text-center font-mono text-[11px] text-fg-dim">
          {me.solanaWalletAddress}
        </p>
      )}
    </main>
  );
}

function HeroAction({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-1 rounded-2xl bg-black/85 px-3 py-3 text-[12px] font-semibold text-white ring-1 ring-black/20 transition hover:bg-black active:scale-[0.97]"
    >
      <span className="h-4 w-4">{icon}</span>
      {label}
    </a>
  );
}
