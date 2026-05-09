'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DollarSign, Percent, Save, TrendingUp } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch } from '@/lib/api/client';
import { formatBRL } from '@/lib/utils';

type FeeCfg = {
  onrampFixedBrl: number;
  onrampPercentBps: number;
  offrampFixedBrl: number;
  offrampPercentBps: number;
  performancePercentBps: number;
  minDepositBrl: number;
  minWithdrawBrl: number;
};

type Revenue = {
  totals: {
    allTimeBrl: number;
    last7Brl: number;
    last30Brl: number;
    thisMonthBrl: number;
    count: number;
  };
  byKind: Array<{ kind: string; totalBrl: number; count: number }>;
  daily: Array<{ date: string; totalBrl: number }>;
};

export default function FinancePage() {
  const qc = useQueryClient();
  const { data: cfg } = useQuery({
    queryKey: ['admin-fee-config'],
    queryFn: () => apiFetch<FeeCfg>('/api/admin/finance/config'),
  });
  const { data: rev } = useQuery({
    queryKey: ['admin-revenue'],
    queryFn: () => apiFetch<Revenue>('/api/admin/finance/revenue'),
  });
  const [form, setForm] = useState<FeeCfg | null>(null);
  useEffect(() => {
    if (cfg && !form) setForm(cfg);
  }, [cfg, form]);

  async function save() {
    if (!form) return;
    try {
      await apiFetch('/api/admin/finance/config', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.success('Configuração salva');
      await qc.invalidateQueries({ queryKey: ['admin-fee-config'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink-50">Finance</h1>
        <p className="text-sm text-ink-400">Fees, receita e configuração</p>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <RevenueCard
          label="Receita total"
          value={rev ? formatBRL(rev.totals.allTimeBrl) : '—'}
          icon={<DollarSign className="h-4 w-4" />}
          accent
        />
        <RevenueCard
          label="Este mês"
          value={rev ? formatBRL(rev.totals.thisMonthBrl) : '—'}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <RevenueCard
          label="Últimos 7d"
          value={rev ? formatBRL(rev.totals.last7Brl) : '—'}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <RevenueCard
          label="Últimos 30d"
          value={rev ? formatBRL(rev.totals.last30Brl) : '—'}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="card">
          <h2 className="mb-4 font-display text-lg font-bold text-ink-50">Receita 30d</h2>
          <div className="h-48">
            {rev && rev.daily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rev.daily}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#6b6b85" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#6b6b85" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(17,17,24,0.9)',
                      color: '#fff',
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [formatBRL(v), 'Receita']}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalBrl"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#revGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-ink-500">
                Sem receita ainda
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="mb-4 font-display text-lg font-bold text-ink-50">Por tipo de fee</h2>
          <div className="space-y-2">
            {rev?.byKind.length === 0 && (
              <p className="text-sm text-ink-400">Nenhum fee coletado</p>
            )}
            {rev?.byKind.map((k) => (
              <div
                key={k.kind}
                className="flex items-center justify-between rounded-xl bg-ink-900/60 px-3 py-2 ring-1 ring-white/5"
              >
                <div>
                  <p className="text-sm font-medium text-ink-100">{k.kind}</p>
                  <p className="text-[10px] text-ink-500">{k.count} cobranças</p>
                </div>
                <p className="font-bold text-brand-300">{formatBRL(k.totalBrl)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 card">
        <div className="mb-4 flex items-center gap-2">
          <Percent className="h-4 w-4 text-brand-300" />
          <h2 className="font-display text-lg font-bold text-ink-50">Configuração de fees</h2>
        </div>

        {form ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FeeRow
              label="Taxa fixa depósito (R$)"
              value={form.onrampFixedBrl}
              onChange={(v) => setForm({ ...form, onrampFixedBrl: v })}
            />
            <FeeRow
              label="Taxa % depósito (bps)"
              value={form.onrampPercentBps}
              onChange={(v) => setForm({ ...form, onrampPercentBps: v })}
              helper={`${(form.onrampPercentBps / 100).toFixed(2)}%`}
            />
            <FeeRow
              label="Taxa fixa saque (R$)"
              value={form.offrampFixedBrl}
              onChange={(v) => setForm({ ...form, offrampFixedBrl: v })}
            />
            <FeeRow
              label="Taxa % saque (bps)"
              value={form.offrampPercentBps}
              onChange={(v) => setForm({ ...form, offrampPercentBps: v })}
              helper={`${(form.offrampPercentBps / 100).toFixed(2)}%`}
            />
            <FeeRow
              label="Performance fee (bps, anual)"
              value={form.performancePercentBps}
              onChange={(v) => setForm({ ...form, performancePercentBps: v })}
              helper={`${(form.performancePercentBps / 100).toFixed(2)}% a.a.`}
            />
            <FeeRow
              label="Mínimo depósito (R$)"
              value={form.minDepositBrl}
              onChange={(v) => setForm({ ...form, minDepositBrl: v })}
            />
            <FeeRow
              label="Mínimo saque (R$)"
              value={form.minWithdrawBrl}
              onChange={(v) => setForm({ ...form, minWithdrawBrl: v })}
            />
          </div>
        ) : (
          <p className="text-sm text-ink-400">Carregando...</p>
        )}

        <button onClick={save} className="btn-primary mt-6 py-2.5 text-sm">
          <Save className="h-4 w-4" />
          Salvar configuração
        </button>
      </section>
    </div>
  );
}

function FeeRow({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="label-field">{label}</span>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input-base"
      />
      {helper && <p className="mt-1 text-[10px] text-ink-500">{helper}</p>}
    </label>
  );
}

function RevenueCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`card p-4 ${accent ? 'bg-emerald-500/5 ring-emerald-500/30' : ''}`}>
      <div className="flex items-center gap-1.5 text-ink-400">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p
        className={`mt-1.5 font-display text-xl font-bold ${
          accent ? 'text-emerald-300' : 'text-ink-50'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
