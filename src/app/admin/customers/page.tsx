'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useAdminCustomers } from '@/hooks/use-admin';
import { formatUSDC } from '@/lib/utils';

export default function AdminCustomers() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const { data, isLoading } = useAdminCustomers({ q, status, limit: 50 });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink-50">Clientes</h1>
        <p className="text-sm text-ink-400">
          {data ? `${data.total} cadastros` : 'Carregando...'}
        </p>
      </header>

      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, email ou wallet..."
            className="input-base pl-10"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="input-base max-w-xs"
        >
          <option value="">Todos</option>
          <option value="onboarded">Cadastrados</option>
          <option value="disabled">Desabilitados</option>
        </select>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-ink-400">Carregando...</div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-400">Nenhum cliente encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-[10px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Saldo</th>
                  <th className="px-4 py-3">Cadastrado em</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-white/5 transition hover:bg-ink-800/40"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/admin/customers/${c.id}`} className="block">
                        <p className="font-medium text-ink-50">{c.fullName ?? '—'}</p>
                        <p className="text-xs text-ink-400">{c.email ?? c.solanaWallet?.slice(0, 12)}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`chip ring-1 ${
                          c.role === 'admin'
                            ? 'bg-brand-500/15 text-brand-300 ring-brand-500/30'
                            : c.role === 'support'
                              ? 'bg-blue-500/15 text-blue-300 ring-blue-500/30'
                              : 'bg-ink-700 text-ink-300 ring-ink-600'
                        }`}
                      >
                        {c.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-ink-50">{formatUSDC(c.usdcCurrentValue, 2)}</p>
                      {c.usdcSupplied !== c.usdcCurrentValue && (
                        <p className="text-[10px] text-brand-300">
                          + {formatUSDC(c.usdcCurrentValue - c.usdcSupplied, 4)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-300">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      {c.disabledAt ? (
                        <span className="chip bg-red-500/15 text-red-300 ring-1 ring-red-500/30">
                          Desabilitado
                        </span>
                      ) : c.onboardedAt ? (
                        <span className="chip bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
                          Ativo
                        </span>
                      ) : (
                        <span className="chip bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30">
                          Incompleto
                        </span>
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
