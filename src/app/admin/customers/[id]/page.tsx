'use client';

import { use } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Ban, CheckCircle2, Shield, ShieldCheck, UserCog } from 'lucide-react';
import { useAdminCustomer } from '@/hooks/use-admin';
import { apiFetch } from '@/lib/api/client';
import { formatBRL, formatUSDC } from '@/lib/utils';

type Detail = {
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    role: 'customer' | 'admin' | 'support';
    cpfMasked: string | null;
    solanaWalletAddress: string | null;
    onboardedAt: string | null;
    disabledAt: string | null;
    createdAt: string;
  };
  position: {
    marketPubkey: string;
    obligationPubkey: string | null;
    usdcSupplied: number;
    usdcCurrentValue: number;
    currentApy: number | null;
    lastSyncedAt: string | null;
  } | null;
  transactions: Array<{
    id: string;
    kind: 'onramp' | 'offramp';
    status: string;
    amountBrl: number | null;
    amountUsdc: number | null;
    fourPTxid: string | null;
    solanaSignature: string | null;
    errorMessage: string | null;
    createdAt: string;
    confirmedAt: string | null;
  }>;
};

export default function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useAdminCustomer(id);
  const qc = useQueryClient();
  const d = data as Detail | undefined;

  async function act(action: string) {
    try {
      await apiFetch(`/api/admin/customers/${id}/actions`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      toast.success(`Ação aplicada: ${action}`);
      await qc.invalidateQueries({ queryKey: ['admin-customer', id] });
      await qc.invalidateQueries({ queryKey: ['admin-customers'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function reconcile(txId: string) {
    try {
      await apiFetch(`/api/admin/transactions/${txId}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success('Reconciliado');
      await qc.invalidateQueries({ queryKey: ['admin-customer', id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function forcePaid(txId: string) {
    if (!confirm('Marcar como PAID manualmente? Isso libera o Kamino deposit. Use só quando 4P não respondeu mas pagamento foi confirmado.')) {
      return;
    }
    try {
      await apiFetch(`/api/admin/transactions/${txId}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({ forcePaid: true }),
      });
      toast.success('Marcado como pago');
      await qc.invalidateQueries({ queryKey: ['admin-customer', id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  }

  if (isLoading || !d) {
    return <div className="p-8 text-sm text-ink-400">Carregando...</div>;
  }

  const { user, position, transactions } = d;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link
        href="/admin/customers"
        className="mb-4 inline-flex items-center gap-2 text-sm text-ink-400 hover:text-ink-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold text-ink-50">
              {user.fullName ?? '—'}
            </h1>
            <span
              className={`chip ring-1 ${
                user.role === 'admin'
                  ? 'bg-brand-500/15 text-brand-300 ring-brand-500/30'
                  : user.role === 'support'
                    ? 'bg-blue-500/15 text-blue-300 ring-blue-500/30'
                    : 'bg-ink-700 text-ink-300 ring-ink-600'
              }`}
            >
              {user.role}
            </span>
            {user.disabledAt && (
              <span className="chip bg-red-500/15 text-red-300 ring-1 ring-red-500/30">
                Desabilitado
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-300">{user.email}</p>
          <p className="font-mono text-xs text-ink-500">{user.solanaWalletAddress}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {user.disabledAt ? (
            <button onClick={() => act('enable')} className="btn-ghost py-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Reativar
            </button>
          ) : (
            <button onClick={() => act('disable')} className="btn-ghost py-2 text-xs">
              <Ban className="h-3.5 w-3.5" />
              Desabilitar
            </button>
          )}
          {user.role === 'customer' && (
            <>
              <button onClick={() => act('promote_support')} className="btn-ghost py-2 text-xs">
                <UserCog className="h-3.5 w-3.5" />
                → Support
              </button>
              <button onClick={() => act('promote_admin')} className="btn-ghost py-2 text-xs">
                <Shield className="h-3.5 w-3.5" />
                → Admin
              </button>
            </>
          )}
          {(user.role === 'admin' || user.role === 'support') && (
            <button onClick={() => act('demote_customer')} className="btn-ghost py-2 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              → Customer
            </button>
          )}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <p className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
            Identidade
          </p>
          <div className="mt-2 space-y-1 text-sm">
            <Row k="CPF" v={user.cpfMasked ?? '—'} />
            <Row k="Cadastrado em" v={new Date(user.createdAt).toLocaleString('pt-BR')} />
            <Row
              k="Onboarded"
              v={user.onboardedAt ? new Date(user.onboardedAt).toLocaleString('pt-BR') : '—'}
            />
          </div>
        </div>

        <div className="card">
          <p className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
            Posição Kamino
          </p>
          {position ? (
            <div className="mt-2 space-y-1 text-sm">
              <Row k="Principal" v={formatUSDC(position.usdcSupplied, 6)} />
              <Row k="Valor atual" v={formatUSDC(position.usdcCurrentValue, 6)} />
              <Row
                k="Rendimento"
                v={`+ ${formatUSDC(position.usdcCurrentValue - position.usdcSupplied, 6)}`}
              />
              <Row k="APY" v={position.currentApy ? `${position.currentApy.toFixed(2)}%` : '—'} />
              <Row
                k="Sync"
                v={
                  position.lastSyncedAt
                    ? new Date(position.lastSyncedAt).toLocaleString('pt-BR')
                    : '—'
                }
              />
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-400">Sem posição ativa</p>
          )}
        </div>
      </section>

      <section className="mt-6 card p-0">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <h2 className="font-display text-lg font-bold text-ink-50">Transações</h2>
          <span className="text-xs text-ink-500">{transactions.length} registros</span>
        </div>
        {transactions.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-400">Nenhuma transação</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-[10px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Valor</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">4P TxId</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-white/5">
                    <td className="px-4 py-2 text-ink-300">
                      {new Date(t.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2 text-ink-100">
                      {t.kind === 'onramp' ? 'Depósito' : 'Saque'}
                    </td>
                    <td className="px-4 py-2 text-ink-50">
                      {formatBRL(t.amountBrl ?? 0)}
                      <span className="ml-2 text-[10px] text-ink-500">
                        {formatUSDC(t.amountUsdc ?? 0, 4)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <StatusChip status={t.status} />
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-ink-400">
                      {t.fourPTxid ? `${t.fourPTxid.slice(0, 10)}...` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {(t.status === 'pending' || t.status === 'processing') && (
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => reconcile(t.id)}
                            className="rounded-full bg-ink-800 px-2 py-1 text-[10px] text-ink-200 hover:bg-ink-700"
                          >
                            Reconciliar
                          </button>
                          <button
                            onClick={() => forcePaid(t.id)}
                            className="rounded-full bg-amber-500/20 px-2 py-1 text-[10px] text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/30"
                          >
                            Forçar paid
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-500">{k}</span>
      <span className="text-right text-ink-100">{v}</span>
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
