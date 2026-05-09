'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { formatBRL } from '@/lib/utils';

type HistoryItem = {
  id: string;
  kind: 'onramp' | 'offramp';
  status: 'pending' | 'processing' | 'paid' | 'error' | 'expired';
  amountBrl: string | null;
  amountUsdc: string | null;
  createdAt: string;
  confirmedAt: string | null;
};

const STATUS_LABEL: Record<HistoryItem['status'], string> = {
  pending: 'Aguardando',
  processing: 'Processando',
  paid: 'Concluído',
  error: 'Erro',
  expired: 'Expirado',
};

const STATUS_STYLE: Record<HistoryItem['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  processing: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  paid: 'bg-brand-500/15 text-brand-300 ring-brand-500/30',
  error: 'bg-red-500/15 text-red-300 ring-red-500/30',
  expired: 'bg-ink-700 text-ink-400 ring-ink-600',
};

export default function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => apiFetch<{ items: HistoryItem[] }>('/api/transactions'),
  });

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 pb-16 pt-6">
      <header className="mb-6 flex items-center gap-3">
        <a
          href="/app"
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink-800/60 text-ink-300 ring-1 ring-white/5 hover:bg-ink-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </a>
        <h1 className="font-display text-2xl font-bold text-ink-50">Histórico</h1>
      </header>

      {isLoading && <p className="text-sm text-ink-400">Carregando...</p>}

      {!isLoading && (data?.items.length ?? 0) === 0 && (
        <div className="card text-center">
          <p className="text-sm text-ink-300">Nenhuma transação ainda.</p>
          <a href="/app/deposit" className="btn-primary mt-4 inline-flex">
            Fazer primeiro depósito
          </a>
        </div>
      )}

      <div className="space-y-2">
        {data?.items.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-3xl bg-ink-800/60 p-4 ring-1 ring-white/5 transition hover:bg-ink-700/60"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  t.kind === 'onramp'
                    ? 'bg-brand-500/20 text-brand-300'
                    : 'bg-ink-700 text-ink-200'
                }`}
              >
                {t.kind === 'onramp' ? (
                  <ArrowDownLeft className="h-5 w-5" />
                ) : (
                  <ArrowUpRight className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-50">
                  {t.kind === 'onramp' ? 'Depósito' : 'Saque'}
                </p>
                <p className="text-xs text-ink-400">
                  {new Date(t.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-ink-50">
                {formatBRL(Number(t.amountBrl ?? 0))}
              </p>
              <span
                className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${STATUS_STYLE[t.status]}`}
              >
                {STATUS_LABEL[t.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
