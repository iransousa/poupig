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
import { formatBRL, formatUSDC } from '@/lib/utils';

export default function AdminDashboard() {
  const { data: m } = useAdminMetrics();
  const { data: tvl } = useTvlSeries(30);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink-50">Dashboard</h1>
        <p className="text-sm text-ink-400">
          {m ? `Atualizado ${new Date(m.generatedAt).toLocaleTimeString('pt-BR')}` : 'Carregando métricas...'}
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <KpiCard
          icon={<Wallet className="h-4 w-4" />}
          label="TVL"
          primary={m ? formatBRL(m.tvl.brl) : '—'}
          secondary={m ? `≈ ${formatUSDC(m.tvl.usdc, 2)}` : ''}
          accent
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Rendimento acumulado"
          primary={m ? `+ ${formatUSDC(m.tvl.yieldUsdc, 4)}` : '—'}
          secondary={m ? `APY médio ${m.tvl.avgApy.toFixed(2)}%` : ''}
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
            <h2 className="font-display text-lg font-bold text-ink-50">TVL últimos 30 dias</h2>
            <p className="text-xs text-ink-400">Snapshots diários em BRL</p>
          </div>
        </div>
        <div className="h-64">
          {tvl && tvl.series.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tvl.series}>
                <defs>
                  <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#6b6b85" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6b6b85" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(17,17,24,0.9)',
                    color: '#fff',
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatBRL(v), 'TVL']}
                />
                <Area
                  type="monotone"
                  dataKey="tvlBrl"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  fill="url(#tvlGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-500">
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
        accent ? 'ring-brand-500/30 bg-brand-500/5' : warn ? 'ring-red-500/30 bg-red-500/5' : ''
      }`}
    >
      <div className={`flex items-center gap-1.5 ${warn ? 'text-red-300' : 'text-ink-400'}`}>
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p
        className={`mt-1.5 font-display text-xl font-bold ${
          accent ? 'text-brand-200' : warn ? 'text-red-300' : 'text-ink-50'
        }`}
      >
        {primary}
      </p>
      {secondary && <p className="text-[11px] text-ink-500">{secondary}</p>}
    </div>
  );
}
