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

const STATUS_CLASS: Record<HistoryItem['status'], string> = {
  pending: 'chip-warning',
  processing: 'chip-accent',
  paid: 'chip-success',
  error: 'chip-danger',
  expired: 'chip-neutral',
};

export default function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => apiFetch<{ items: HistoryItem[] }>('/api/transactions'),
  });

  return (
    <main className="mx-auto max-w-lg px-5 pb-16 pt-6">
      <header className="mb-5 flex items-center gap-3">
        <a
          href="/app"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-2 text-fg-mid ring-1 ring-line hover:bg-bg-3"
        >
          <ArrowLeft className="h-4 w-4" />
        </a>
        <h1 className="text-h2 text-fg">Histórico</h1>
      </header>

      {isLoading && <p className="text-[13px] text-fg-mid">Carregando...</p>}

      {!isLoading && (data?.items.length ?? 0) === 0 && (
        <div className="card text-center">
          <p className="text-[13px] text-fg-mid">Nenhuma transação ainda.</p>
          <a href="/app/deposit" className="btn-primary mt-4 inline-flex">
            Fazer primeiro depósito
          </a>
        </div>
      )}

      <div className="space-y-1">
        {data?.items.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-[20px] bg-bg-1 p-4 ring-1 ring-line transition hover:bg-bg-2"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-[10px] ${
                  t.kind === 'onramp' ? 'bg-accent-soft text-accent' : 'bg-bg-3 text-fg-mid'
                }`}
              >
                {t.kind === 'onramp' ? (
                  <ArrowDownLeft className="h-4 w-4" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="text-[14px] font-medium text-fg">
                  {t.kind === 'onramp' ? 'Depósito' : 'Saque'}
                </p>
                <p className="text-[11px] text-fg-dim">
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
              <p className="text-[14px] font-semibold text-fg">
                {formatBRL(Number(t.amountBrl ?? 0))}
              </p>
              <span className={`chip ${STATUS_CLASS[t.status]} mt-1`}>
                {STATUS_LABEL[t.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
