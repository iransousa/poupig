'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { RefreshCw, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { formatBRL, formatUSDC } from '@/lib/utils';

type Row = {
  id: string;
  kind: 'onramp' | 'offramp';
  status: string;
  amountBrl: number | null;
  amountUsdc: number | null;
  fourPTxid: string | null;
  solanaSignature: string | null;
  errorMessage: string | null;
  createdAt: string;
  userId: string;
  userEmail: string | null;
  userFullName: string | null;
};

const STATUS_OPTS = ['', 'pending', 'processing', 'paid', 'error', 'expired'];

export default function AdminTransactions() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const qc = useQueryClient();

  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (status) qs.set('status', status);
  if (kind) qs.set('kind', kind);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-transactions', q, status, kind],
    queryFn: () => apiFetch<{ items: Row[]; total: number }>(`/api/admin/transactions?${qs}`),
  });

  async function reconcile(id: string) {
    try {
      await apiFetch(`/api/admin/transactions/${id}/reconcile`, { method: 'POST' });
      toast.success('Reconciliado');
      await qc.invalidateQueries({ queryKey: ['admin-transactions'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-50">Transações</h1>
          <p className="text-sm text-ink-400">
            {data ? `${data.total} no filtro` : 'Carregando...'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-ghost py-2 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </header>

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Email, nome ou 4P txid..."
            className="input-base pl-10"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-base">
          {STATUS_OPTS.map((s) => (
            <option key={s} value={s}>
              {s || 'Todos status'}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="input-base">
          <option value="">Todos tipos</option>
          <option value="onramp">Depósito</option>
          <option value="offramp">Saque</option>
        </select>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-ink-400">Carregando...</div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-400">Nenhuma transação</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-[10px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Erro</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t) => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-ink-800/40">
                    <td className="px-4 py-3 text-ink-300">
                      {new Date(t.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/customers/${t.userId}`} className="hover:text-brand-300">
                        <p className="text-ink-50">{t.userFullName ?? '—'}</p>
                        <p className="text-[10px] text-ink-500">{t.userEmail}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-100">
                      {t.kind === 'onramp' ? 'Depósito' : 'Saque'}
                    </td>
                    <td className="px-4 py-3 text-ink-50">
                      {formatBRL(t.amountBrl ?? 0)}
                      <span className="ml-1 text-[10px] text-ink-500">
                        {formatUSDC(t.amountUsdc ?? 0, 2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-[10px] text-red-300">
                      {t.errorMessage?.slice(0, 50) ?? ''}
                    </td>
                    <td className="px-4 py-3">
                      {(t.status === 'pending' || t.status === 'processing') && (
                        <button
                          onClick={() => reconcile(t.id)}
                          className="rounded-full bg-ink-800 px-2 py-1 text-[10px] text-ink-200 hover:bg-ink-700"
                        >
                          Reconciliar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-brand-500/15 text-brand-300 ring-brand-500/30',
    pending: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    processing: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',
    error: 'bg-red-500/15 text-red-300 ring-red-500/30',
    expired: 'bg-ink-700 text-ink-400 ring-ink-600',
  };
  return <span className={`chip ring-1 ${map[status] ?? map.pending}`}>{status}</span>;
}
