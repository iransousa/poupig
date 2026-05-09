'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Layers, Play, Plus, Search, TrendingUp, Vault } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';

type Target = {
  id: string;
  kind: 'reserve' | 'vault';
  label: string;
  symbol: string;
  marketPubkey: string;
  targetPubkey: string;
  mintPubkey: string;
  weightBps: number;
};
type Strategy = {
  id: string;
  name: string;
  description: string | null;
  active: string | null;
  targets: Target[];
  totalWeightBps: number;
};

type Reserve = {
  symbol: string;
  mint: string;
  address: string;
  supplyApy: number;
  tvl: number | null;
  utilization: number | null;
  label: string;
};

type Vault = {
  name: string;
  symbol: string;
  manager?: string;
  tokenSymbol?: string;
  profile?: string;
  address: string;
  mint: string;
  tvl: number | null;
  tvlUsd?: number | null;
  apy: number;
  strategy: string;
  risk: 'low' | 'medium' | 'high';
  description: string;
};

const DEFAULT_MARKET = '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF';

function fmtTvl(v: number | null, symbol?: string) {
  if (v == null || v === 0) return '—';
  const suffix = symbol ? ` ${symbol}` : '';
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B${suffix}`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M${suffix}`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K${suffix}`;
  return `${v.toFixed(2)}${suffix}`;
}

export default function StrategiesPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const { data: list } = useQuery({
    queryKey: ['admin-strategies'],
    queryFn: () => apiFetch<{ items: Strategy[] }>('/api/admin/strategies'),
  });
  const { data: reservesData } = useQuery({
    queryKey: ['admin-kamino-reserves'],
    queryFn: () =>
      apiFetch<{ env: string; market: string; reserves: Reserve[] }>(
        '/api/admin/kamino/reserves',
      ),
  });
  const { data: vaultsData } = useQuery({
    queryKey: ['admin-kamino-vaults'],
    queryFn: () => apiFetch<{ env: string; vaults: Vault[] }>('/api/admin/kamino/vaults'),
  });
  const { data: current } = useQuery({
    queryKey: ['admin-strategy-current'],
    queryFn: () =>
      apiFetch<{ strategyName: string; targets: Target[]; isDefault: boolean }>(
        '/api/admin/strategies/current',
      ),
  });

  async function activate(id: string) {
    try {
      await apiFetch(`/api/admin/strategies/${id}/activate`, { method: 'POST' });
      toast.success('Estratégia ativada');
      await qc.invalidateQueries({ queryKey: ['admin-strategies'] });
      await qc.invalidateQueries({ queryKey: ['admin-strategy-current'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-50">Estratégias</h1>
          <p className="text-sm text-ink-400">
            Monte alocações combinando reserves (lending) + vaults (liquidity)
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary py-2 text-sm">
          <Plus className="h-4 w-4" />
          Nova estratégia
        </button>
      </header>

      <section className="card mb-6">
        <p className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
          Estratégia ativa
        </p>
        <p className="mt-1 font-display text-xl font-bold text-brand-200">
          {current?.strategyName ?? '—'}
        </p>
        {current?.isDefault && (
          <p className="text-xs text-amber-300">
            Nenhuma estratégia customizada ativa — usando fallback (Main Market 100%)
          </p>
        )}
        {current && (
          <div className="mt-3 flex flex-wrap gap-2">
            {current.targets.map((t) => (
              <div
                key={t.id}
                className="rounded-xl bg-ink-800 px-3 py-2 text-xs ring-1 ring-white/5"
              >
                <div className="flex items-center gap-1.5">
                  {t.kind === 'reserve' ? (
                    <Layers className="h-3 w-3 text-blue-300" />
                  ) : (
                    <Vault className="h-3 w-3 text-brand-300" />
                  )}
                  <p className="font-semibold text-ink-100">{t.label}</p>
                </div>
                <p className="text-[10px] text-ink-400">
                  {(t.weightBps / 100).toFixed(2)}% · {t.kind}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        {list?.items.length === 0 && (
          <div className="card text-center text-sm text-ink-400">
            Nenhuma estratégia criada ainda.
          </div>
        )}
        {list?.items.map((s) => (
          <div key={s.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-lg font-bold text-ink-50">{s.name}</p>
                  {s.active && (
                    <span className="chip bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
                      ATIVA
                    </span>
                  )}
                </div>
                {s.description && <p className="mt-0.5 text-xs text-ink-400">{s.description}</p>}
              </div>
              {!s.active && (
                <button onClick={() => activate(s.id)} className="btn-ghost py-2 text-xs">
                  <Play className="h-3.5 w-3.5" />
                  Ativar
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {s.targets.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl bg-ink-900/60 px-3 py-2 text-xs ring-1 ring-white/5"
                >
                  <div className="flex items-center gap-1.5">
                    {t.kind === 'reserve' ? (
                      <Layers className="h-3 w-3 text-blue-300" />
                    ) : (
                      <Vault className="h-3 w-3 text-brand-300" />
                    )}
                    <p className="font-semibold text-ink-100">{t.label}</p>
                  </div>
                  <p className="text-[10px] text-ink-400">
                    {(t.weightBps / 100).toFixed(2)}% · {t.kind} · {t.symbol}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {showNew && (
        <NewStrategyModal
          reserves={reservesData?.reserves ?? []}
          vaults={vaultsData?.vaults ?? []}
          onClose={() => setShowNew(false)}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ['admin-strategies'] });
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}

type Selection = { kind: 'reserve' | 'vault'; weightBps: number };

function NewStrategyModal({
  reserves,
  vaults,
  onClose,
  onSaved,
}: {
  reserves: Reserve[];
  vaults: Vault[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('Minha estratégia');
  const [description, setDescription] = useState('');
  const [tab, setTab] = useState<'reserve' | 'vault'>('reserve');
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<'symbol' | 'apy' | 'tvl' | 'utilization' | 'risk'>(
    'apy',
  );
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filteredReserves = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...reserves]
      .filter((r) => !q || r.symbol.toLowerCase().includes(q) || r.label.toLowerCase().includes(q))
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortKey === 'symbol') return a.symbol.localeCompare(b.symbol) * dir;
        if (sortKey === 'apy') return (a.supplyApy - b.supplyApy) * dir;
        if (sortKey === 'tvl') return ((a.tvl ?? 0) - (b.tvl ?? 0)) * dir;
        if (sortKey === 'utilization')
          return ((a.utilization ?? 0) - (b.utilization ?? 0)) * dir;
        return 0;
      });
  }, [reserves, query, sortKey, sortDir]);

  const filteredVaults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const riskOrder = { low: 0, medium: 1, high: 2 } as const;
    return [...vaults]
      .filter(
        (v) =>
          !q || v.symbol.toLowerCase().includes(q) || v.name.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortKey === 'symbol') return a.name.localeCompare(b.name) * dir;
        if (sortKey === 'apy') return (a.apy - b.apy) * dir;
        if (sortKey === 'tvl') return ((a.tvl ?? 0) - (b.tvl ?? 0)) * dir;
        if (sortKey === 'risk') return (riskOrder[a.risk] - riskOrder[b.risk]) * dir;
        return 0;
      });
  }, [vaults, query, sortKey, sortDir]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'symbol' ? 'asc' : 'desc');
    }
  }

  const totalBps = useMemo(
    () => Object.values(selections).reduce((s, v) => s + v.weightBps, 0),
    [selections],
  );

  function setWeight(addr: string, kind: 'reserve' | 'vault', bps: number) {
    setSelections((s) => {
      const next = { ...s };
      if (bps <= 0) delete next[addr];
      else next[addr] = { kind, weightBps: bps };
      return next;
    });
  }

  async function save() {
    const targets: Array<{
      kind: 'reserve' | 'vault';
      label: string;
      marketPubkey: string;
      targetPubkey: string;
      mintPubkey: string;
      symbol: string;
      weightBps: number;
    }> = [];

    for (const r of reserves) {
      const sel = selections[r.address];
      if (sel?.weightBps) {
        targets.push({
          kind: 'reserve',
          label: r.label,
          marketPubkey: DEFAULT_MARKET,
          targetPubkey: r.address,
          mintPubkey: r.mint,
          symbol: r.symbol,
          weightBps: sel.weightBps,
        });
      }
    }
    for (const v of vaults) {
      const sel = selections[v.address];
      if (sel?.weightBps) {
        targets.push({
          kind: 'vault',
          label: v.name,
          marketPubkey: DEFAULT_MARKET,
          targetPubkey: v.address,
          mintPubkey: v.mint,
          symbol: v.symbol,
          weightBps: sel.weightBps,
        });
      }
    }

    if (targets.length === 0) {
      toast.error('Selecione ao menos 1 target');
      return;
    }
    if (totalBps !== 10000) {
      toast.error(`Soma dos pesos deve ser 100% (atual: ${(totalBps / 100).toFixed(2)}%)`);
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/admin/strategies', {
        method: 'POST',
        body: JSON.stringify({ name, description, targets }),
      });
      toast.success('Estratégia criada');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSaving(false);
    }
  }

  const selectedReserves = reserves.filter((r) => selections[r.address]);
  const selectedVaults = vaults.filter((v) => selections[v.address]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink-50">Nova estratégia</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-50">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da estratégia"
            className="input-base"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            className="input-base"
          />
        </div>

        {(selectedReserves.length > 0 || selectedVaults.length > 0) && (
          <div className="mt-5 rounded-2xl bg-brand-500/5 p-3 ring-1 ring-brand-500/20">
            <p className="text-[10px] font-medium uppercase tracking-wider text-brand-300">
              Selecionados ({selectedReserves.length + selectedVaults.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedReserves.map((r) => (
                <Pill
                  key={r.address}
                  kind="reserve"
                  label={r.label}
                  weight={selections[r.address].weightBps}
                  onRemove={() => setWeight(r.address, 'reserve', 0)}
                />
              ))}
              {selectedVaults.map((v) => (
                <Pill
                  key={v.address}
                  kind="vault"
                  label={v.name}
                  weight={selections[v.address].weightBps}
                  onRemove={() => setWeight(v.address, 'vault', 0)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-2 border-b border-white/5">
          <button
            onClick={() => setTab('reserve')}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === 'reserve'
                ? 'border-brand-500 text-brand-200'
                : 'border-transparent text-ink-400 hover:text-ink-100'
            }`}
          >
            <Layers className="h-4 w-4" />
            Reserves · {reserves.length}
          </button>
          <button
            onClick={() => setTab('vault')}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === 'vault'
                ? 'border-brand-500 text-brand-200'
                : 'border-transparent text-ink-400 hover:text-ink-100'
            }`}
          >
            <Vault className="h-4 w-4" />
            Vaults · {vaults.length}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por símbolo ou nome..."
              className="input-base pl-9 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-ink-400">
            <span>Ordenar:</span>
            <SortBtn
              active={sortKey === 'symbol'}
              dir={sortDir}
              onClick={() => toggleSort('symbol')}
            >
              Ativo
            </SortBtn>
            <SortBtn
              active={sortKey === 'apy'}
              dir={sortDir}
              onClick={() => toggleSort('apy')}
            >
              APY
            </SortBtn>
            <SortBtn
              active={sortKey === 'tvl'}
              dir={sortDir}
              onClick={() => toggleSort('tvl')}
            >
              TVL
            </SortBtn>
            {tab === 'reserve' && (
              <SortBtn
                active={sortKey === 'utilization'}
                dir={sortDir}
                onClick={() => toggleSort('utilization')}
              >
                Util
              </SortBtn>
            )}
            {tab === 'vault' && (
              <SortBtn
                active={sortKey === 'risk'}
                dir={sortDir}
                onClick={() => toggleSort('risk')}
              >
                Risco
              </SortBtn>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {tab === 'reserve' &&
            (filteredReserves.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">
                Nenhum reserve encontrado
              </p>
            ) : (
              filteredReserves.map((r) => (
                <ReserveCard
                  key={r.address}
                  reserve={r}
                  weight={(selections[r.address]?.weightBps ?? 0) / 100}
                  onChange={(pct) => setWeight(r.address, 'reserve', Math.round(pct * 100))}
                />
              ))
            ))}
          {tab === 'vault' &&
            (filteredVaults.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">
                Nenhum vault encontrado
              </p>
            ) : (
              filteredVaults.map((v) => (
                <VaultCard
                  key={v.address}
                  vault={v}
                  weight={(selections[v.address]?.weightBps ?? 0) / 100}
                  onChange={(pct) => setWeight(v.address, 'vault', Math.round(pct * 100))}
                />
              ))
            ))}
        </div>

        <div className="sticky bottom-0 mt-6 flex items-center justify-between border-t border-white/5 bg-ink-800/95 pt-4 backdrop-blur">
          <div>
            <p
              className={`text-sm font-semibold ${
                totalBps === 10000 ? 'text-brand-300' : 'text-amber-300'
              }`}
            >
              Total: {(totalBps / 100).toFixed(2)}% {totalBps === 10000 ? '✓' : ''}
            </p>
            <p className="text-[10px] text-ink-500">
              {totalBps === 10000 ? 'pronto pra criar' : 'soma deve ser exatamente 100%'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost py-2 text-sm">
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving || totalBps !== 10000}
              className="btn-primary py-2 text-sm"
            >
              {saving ? 'Salvando...' : 'Criar estratégia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReserveCard({
  reserve: r,
  weight,
  onChange,
}: {
  reserve: Reserve;
  weight: number;
  onChange: (pct: number) => void;
}) {
  const selected = weight > 0;
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl p-3 transition ${
        selected
          ? 'bg-brand-500/10 ring-1 ring-brand-500/40'
          : 'bg-ink-900/60 ring-1 ring-white/5 hover:bg-ink-900/80'
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
        <Layers className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink-50">{r.label}</p>
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-ink-400">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-brand-300" />
            APY <strong className="text-brand-300">{r.supplyApy.toFixed(2)}%</strong>
          </span>
          <span>TVL {fmtTvl(r.tvl, r.symbol)}</span>
          {r.utilization != null && <span>Util {(r.utilization * 100).toFixed(0)}%</span>}
          <span className="font-mono text-ink-500">{r.symbol}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          max="100"
          step="5"
          placeholder="0"
          value={weight || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="input-base w-20 py-2 text-center text-sm"
        />
        <span className="text-xs text-ink-400">%</span>
      </div>
    </div>
  );
}

function VaultCard({
  vault: v,
  weight,
  onChange,
}: {
  vault: Vault;
  weight: number;
  onChange: (pct: number) => void;
}) {
  const selected = weight > 0;
  const riskColor = {
    low: 'bg-brand-500/15 text-brand-300 ring-brand-500/30',
    medium: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    high: 'bg-red-500/15 text-red-300 ring-red-500/30',
  }[v.risk];

  const profileColor = (() => {
    if (v.profile === 'Conservative') return 'bg-blue-500/15 text-blue-300 ring-blue-500/30';
    if (v.profile === 'Boosted') return 'bg-amber-500/15 text-amber-300 ring-amber-500/30';
    return 'bg-ink-700 text-ink-200 ring-white/10';
  })();

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl p-3 transition ${
        selected
          ? 'bg-brand-500/10 ring-1 ring-brand-500/40'
          : 'bg-ink-900/60 ring-1 ring-white/5 hover:bg-ink-900/80'
      }`}
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
        <Vault className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink-50">{v.name}</p>
          {v.profile && <span className={`chip ring-1 ${profileColor}`}>{v.profile}</span>}
          <span className={`chip ring-1 ${riskColor}`}>{v.risk}</span>
        </div>
        {v.manager && (
          <p className="mt-0.5 text-[11px] text-ink-500">
            por <strong className="text-ink-300">{v.manager}</strong>
            {v.tokenSymbol && (
              <>
                {' · '}
                <span className="font-mono">{v.tokenSymbol}</span>
              </>
            )}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-ink-400">
          {v.apy > 0 && (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-brand-300" />
              APY <strong className="text-brand-300">{v.apy.toFixed(2)}%</strong>
            </span>
          )}
          <span>
            TVL{' '}
            <strong className="text-ink-200">
              {fmtTvl(v.tvl, v.tokenSymbol ?? v.symbol)}
            </strong>
          </span>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        <input
          type="number"
          min="0"
          max="100"
          step="5"
          placeholder="0"
          value={weight || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="input-base w-20 py-2 text-center text-sm"
        />
        <span className="text-xs text-ink-400">%</span>
      </div>
    </div>
  );
}

function SortBtn({
  children,
  active,
  dir,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium transition ${
        active
          ? 'bg-brand-500/15 text-brand-200 ring-1 ring-brand-500/30'
          : 'bg-ink-800 text-ink-400 ring-1 ring-white/5 hover:text-ink-100'
      }`}
    >
      {children}
      {active && (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );
}

function Pill({
  kind,
  label,
  weight,
  onRemove,
}: {
  kind: 'reserve' | 'vault';
  label: string;
  weight: number;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-ink-800 py-1 pl-2 pr-1 text-xs ring-1 ring-white/5">
      {kind === 'reserve' ? (
        <Layers className="h-3 w-3 text-blue-300" />
      ) : (
        <Vault className="h-3 w-3 text-brand-300" />
      )}
      <span className="font-medium text-ink-100">{label}</span>
      <span className="text-ink-400">{(weight / 100).toFixed(0)}%</span>
      <button
        onClick={onRemove}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-700 text-ink-400 hover:bg-red-500/20 hover:text-red-300"
      >
        ✕
      </button>
    </div>
  );
}
