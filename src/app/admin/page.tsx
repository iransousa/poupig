'use client';

import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAdminMetrics, useTvlSeries } from '@/hooks/use-admin';
import { formatBRL, formatPct, formatUSD } from '@/lib/utils';

export default function AdminDashboard() {
  const { data: m } = useAdminMetrics();
  const { data: tvl } = useTvlSeries(30);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-h1 text-fg">Dashboard</h1>
        <p className="text-[13px] text-fg-mid">
          {m
            ? `Atualizado ${new Date(m.generatedAt).toLocaleTimeString('pt-BR')}`
            : 'Carregando métricas...'}
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="TVL"
          primary={m ? formatBRL(m.tvl.brl) : '—'}
          secondary={m ? `≈ ${formatUSD(m.tvl.usdc, 2)}` : ''}
          accent
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Rendimento acumulado"
          primary={m ? `+ ${formatUSD(m.tvl.yieldUsdc, 4)}` : '—'}
          secondary={m ? `APY médio ${formatPct(m.tvl.avgApy)}` : ''}
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Usuários com posição"
          primary={m ? m.users.activeWithPosition.toString() : '—'}
          secondary={m ? `${m.users.onboarded} cadastrados (${m.users.total} Privy)` : ''}
        />
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-4">
        <KpiCard
          icon={<ArrowDownLeft className="h-4 w-4" />}
          label="Depósitos 7d"
          primary={m ? formatBRL(m.volume7d.depositsBrl) : '—'}
        />
        <KpiCard
          icon={<ArrowUpRight className="h-4 w-4" />}
          label="Saques 7d"
          primary={m ? formatBRL(m.volume7d.withdrawsBrl) : '—'}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Pendentes"
          primary={m ? m.volume7d.pending.toString() : '—'}
          secondary="aguardando webhook"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Falhas 7d"
          primary={m ? m.volume7d.failures.toString() : '—'}
          warn={!!(m && m.volume7d.failures > 0)}
        />
      </section>

      <section className="mt-6 card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-h3 text-fg">TVL últimos 30 dias</h2>
            <p className="text-[11px] text-fg-dim">Snapshots diários em BRL</p>
          </div>
        </div>
        <div className="h-64">
          {tvl && tvl.series.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tvl.series}>
                <defs>
                  <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--p-accent)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--p-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="rgba(247,247,248,0.38)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(247,247,248,0.38)" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(28,28,31,0.95)',
                    color: '#F7F7F8',
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatBRL(v), 'TVL']}
                />
                <Area
                  type="monotone"
                  dataKey="tvlBrl"
                  stroke="var(--p-accent)"
                  strokeWidth={2.5}
                  fill="url(#tvlGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-[13px] text-fg-dim">
              Sem snapshots ainda
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  primary,
  secondary,
  accent,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`card p-4 ${
        accent ? 'bg-accent-soft ring-accent/30' : warn ? 'bg-danger/5 ring-danger/30' : ''
      }`}
    >
      <div className={`flex items-center gap-1.5 ${warn ? 'text-danger' : 'text-fg-dim'}`}>
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p
        className={`mt-1.5 text-h3 ${
          accent ? 'text-accent' : warn ? 'text-danger' : 'text-fg'
        }`}
      >
        {primary}
      </p>
      {secondary && <p className="text-[11px] text-fg-dim">{secondary}</p>}
    </div>
  );
}
