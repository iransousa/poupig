'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { YieldSeries } from '@/hooks/use-yield';
import { formatBRL } from '@/lib/utils';

export function YieldChart({ series }: { series: YieldSeries[] }) {
  if (!series || series.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-[11px] text-fg-dim">
        Seu rendimento aparece aqui 📈
      </div>
    );
  }
  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--p-accent)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--p-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(28, 28, 31, 0.95)',
              fontSize: 12,
              color: '#F7F7F8',
              backdropFilter: 'blur(8px)',
            }}
            labelFormatter={(d: string) => new Date(d).toLocaleDateString('pt-BR')}
            formatter={(v: number) => [formatBRL(v), 'Saldo']}
          />
          <Area
            type="monotone"
            dataKey="brl"
            stroke="var(--p-accent)"
            strokeWidth={2.5}
            fill="url(#chartGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
