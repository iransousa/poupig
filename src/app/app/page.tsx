'use client';

import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { ArrowDownLeft, ArrowUpRight, History, LogOut, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { useMe } from '@/hooks/use-me';
import { useBalance } from '@/hooks/use-balance';
import { useYield } from '@/hooks/use-yield';
import { formatBRL, formatUSDC } from '@/lib/utils';
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
  const qc = useQueryClient();

  const apy = yieldData?.apy ?? balance?.apy ?? 0;
  const currentBrl = yieldData?.currentBrl ?? balance?.brl ?? 0;
  const currentUsdc = yieldData?.currentUsdc ?? balance?.usdc ?? 0;

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
    <main className="mx-auto min-h-screen max-w-lg px-5 pb-16 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-brand font-display font-bold text-white shadow-glow">
            P
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-ink-400">Olá,</p>
              <EnvBadge />
            </div>
            <p className="text-sm font-semibold text-ink-50">
              {me?.fullName?.split(' ')[0] ?? me?.email ?? 'user'}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink-800/60 text-ink-300 ring-1 ring-white/5 transition hover:bg-ink-700 hover:text-ink-50"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <PreflightBanner />

      <section className="card-hero animate-slide-up">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white/70">
            <Wallet className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wider">Saldo total</span>
          </div>
          <p className="mt-2 font-display text-5xl font-bold tracking-tight text-white">
            {formatBRL(currentBrl)}
          </p>
          <p className="mt-1 text-sm text-white/70">≈ {formatUSDC(currentUsdc)}</p>

          <div className="mt-5">
            <YieldChart series={yieldData?.series ?? []} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <a
              href="/app/deposit"
              className="group flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 font-semibold text-brand-700 transition hover:bg-white/90 active:scale-[0.98]"
            >
              <ArrowDownLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 group-hover:translate-y-0.5" />
              Depositar
            </a>
            <a
              href="/app/withdraw"
              className="group flex items-center justify-center gap-2 rounded-2xl bg-white/10 py-3.5 font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
            >
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              Sacar
            </a>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-3">
        <StatCard
          label="Rendeu hoje"
          value={`+ ${formatBRL(yieldData?.yieldTodayBRL ?? 0)}`}
          icon={<Sparkles className="h-3.5 w-3.5" />}
          accent
        />
        <StatCard
          label="No mês"
          value={`+ ${formatBRL(yieldData?.yieldMonthBRL ?? 0)}`}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          accent
        />
        <StatCard
          label="APY"
          value={apy ? `${apy.toFixed(2)}%` : '—'}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          sub="Kamino"
        />
      </section>

      <a
        href="/app/history"
        className="mt-4 flex w-full items-center justify-between rounded-3xl bg-ink-800/60 p-4 ring-1 ring-white/5 transition hover:bg-ink-700/60"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-700 text-ink-200">
            <History className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium text-ink-100">Histórico de transações</span>
        </div>
        <ArrowUpRight className="h-4 w-4 text-ink-400" />
      </a>

      {(me?.role === 'admin' || me?.role === 'support') && (
        <a
          href="/admin"
          className="mt-2 flex w-full items-center justify-between rounded-3xl bg-brand-500/10 p-4 ring-1 ring-brand-500/30 transition hover:bg-brand-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/20 text-brand-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-200">Painel administrativo</p>
              <p className="text-[10px] text-brand-300/70">Role: {me.role}</p>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-brand-300" />
        </a>
      )}

      {IS_MOCK && (
        <button
          onClick={takeSnapshot}
          className="mt-4 w-full rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs font-medium text-amber-300 hover:bg-amber-500/10"
        >
          🧪 Tirar snapshot agora · mock
        </button>
      )}

      {me?.solanaWalletAddress && (
        <p className="mt-8 break-all text-center font-mono text-[10px] text-ink-500">
          {me.solanaWalletAddress}
        </p>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-ink-400">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p
        className={`mt-1.5 text-sm font-bold ${accent ? 'text-brand-300' : 'text-ink-50'}`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-ink-500">{sub}</p>}
    </div>
  );
}
