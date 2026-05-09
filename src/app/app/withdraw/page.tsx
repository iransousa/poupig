'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { formatBRL, formatUSDC } from '@/lib/utils';
import { useBalance } from '@/hooks/use-balance';
import { useTransaction } from '@/hooks/use-transaction';
import { useKaminoSigning } from '@/hooks/use-kamino-signing';
import { useKaminoConfig } from '@/hooks/use-kamino-config';
import { EnvBadge } from '@/components/env-badge';
import { PreflightBanner } from '@/components/preflight-banner';

type QuoteResponse = { amountIn: number; amountOut: number; rate: number };

type WithdrawCreated = {
  id: string;
  status: string;
  amountBRL: number;
  amountUSDC: number;
  pixKey: string;
};

const IS_MOCK = process.env.NEXT_PUBLIC_FOUR_P_DRIVER === 'mock';

export default function WithdrawPage() {
  const router = useRouter();
  const { data: balance } = useBalance();
  const { data: kaminoCfg } = useKaminoConfig();
  const { signAndConfirm } = useKaminoSigning();
  const [amount, setAmount] = useState('50');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [signing, setSigning] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [payload, setPayload] = useState<WithdrawCreated | null>(null);
  const [kaminoSig, setKaminoSig] = useState<string | null>(null);

  const { data: tx } = useTransaction(txId);
  const status = tx?.status ?? payload?.status ?? null;
  const isPaid = status === 'paid';
  const isProcessing = status === 'pending' || status === 'processing';
  const kaminoRealMode = kaminoCfg?.env && kaminoCfg.env !== 'mock';

  const maxBRL = balance?.brl ?? 0;

  async function fetchQuote() {
    try {
      const n = Number(amount);
      if (!n || n <= 0) return;
      const q = await apiFetch<QuoteResponse>('/api/quote', {
        method: 'POST',
        body: JSON.stringify({ amount: n, from: 'BRL', to: 'USDC' }),
      });
      setQuote(q);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na cotação');
    }
  }

  async function doKaminoWithdrawIfNeeded(amountUSDC: number): Promise<string | null> {
    if (!kaminoRealMode) return null;
    setSigning(true);
    try {
      const { signature } = await signAndConfirm('prepare-withdraw', 'confirm-withdraw', {
        amountUSDC,
      });
      setKaminoSig(signature);
      toast.success('USDC retirado do Kamino on-chain!');
      return signature;
    } finally {
      setSigning(false);
    }
  }

  async function createWithdraw() {
    setCreating(true);
    try {
      const amountBRL = Number(amount);
      if (kaminoRealMode) {
        const q = quote ?? (await apiFetch<QuoteResponse>('/api/quote', {
          method: 'POST',
          body: JSON.stringify({ amount: amountBRL, from: 'BRL', to: 'USDC' }),
        }));
        await doKaminoWithdrawIfNeeded(q.amountOut);
      }
      const res = await apiFetch<WithdrawCreated>('/api/withdraw/create', {
        method: 'POST',
        body: JSON.stringify({ amountBRL }),
      });
      setPayload(res);
      setTxId(res.id);
      toast.success('Saque iniciado!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao sacar';
      if (msg === 'insufficient_balance') toast.error('Saldo insuficiente');
      else toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function simulatePayment() {
    if (!txId) return;
    try {
      await apiFetch('/api/mock/4p-pay', {
        method: 'POST',
        body: JSON.stringify({ transactionId: txId }),
      });
      toast.success('PIX simulado!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 pb-16 pt-6">
      <header className="mb-6 flex items-center gap-3">
        <a
          href="/app"
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink-800/60 text-ink-300 ring-1 ring-white/5 hover:bg-ink-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </a>
        <h1 className="font-display text-2xl font-bold text-ink-50">Sacar</h1>
        <div className="ml-auto">
          <EnvBadge />
        </div>
      </header>

      <PreflightBanner />

      {!payload && (
        <section className="card animate-slide-up">
          <div className="mb-5 rounded-2xl bg-ink-900/60 p-3 ring-1 ring-white/5">
            <p className="text-xs text-ink-400">Disponível</p>
            <p className="font-display text-lg font-bold text-ink-50">{formatBRL(maxBRL)}</p>
            <p className="text-xs text-ink-500">≈ {formatUSDC(balance?.usdc ?? 0)}</p>
          </div>

          <label className="block">
            <span className="label-field">Valor em reais</span>
            <div className="flex items-center rounded-2xl border border-ink-700 bg-ink-900/60 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30">
              <span className="pl-4 text-ink-400">R$</span>
              <input
                type="number"
                min="1"
                max={maxBRL}
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setQuote(null);
                }}
                onBlur={fetchQuote}
                className="w-full rounded-2xl bg-transparent px-2 py-3.5 text-lg font-semibold text-ink-50 focus:outline-none"
              />
            </div>
          </label>

          <div className="mt-3 flex gap-2">
            {[0.25, 0.5, 1].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setAmount((maxBRL * pct).toFixed(2))}
                className="btn-pill"
              >
                {pct === 1 ? 'Tudo' : `${pct * 100}%`}
              </button>
            ))}
          </div>

          {quote && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-brand-500/10 p-3 text-sm text-brand-200 ring-1 ring-brand-500/20">
              <Sparkles className="h-4 w-4" />
              Serão descontados <strong>{formatUSDC(quote.amountOut, 6)}</strong>
            </div>
          )}

          <button
            onClick={createWithdraw}
            disabled={
              creating || signing || !amount || Number(amount) <= 0 || Number(amount) > maxBRL
            }
            className="btn-primary mt-6 w-full py-4 text-base"
          >
            {signing
              ? 'Assinando Kamino...'
              : creating
                ? 'Processando...'
                : 'Sacar via PIX'}
          </button>

          {IS_MOCK && (
            <p className="mt-3 text-center text-xs text-amber-300/80">Modo MOCK · PIX simulado</p>
          )}
          {kaminoRealMode && (
            <p className="mt-1 text-center text-xs text-brand-300">
              Kamino {kaminoCfg?.env} · withdraw on-chain antes do PIX
            </p>
          )}
        </section>
      )}

      {payload && (
        <section className="card animate-slide-up">
          {isPaid ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/20 text-brand-300 shadow-glow">
                <Check className="h-10 w-10" strokeWidth={3} />
              </div>
              <h2 className="font-display text-2xl font-bold text-ink-50">PIX enviado!</h2>
              <p className="mt-1 text-sm text-ink-300">
                {formatBRL(payload.amountBRL)} caíram na sua chave PIX.
              </p>
              <p className="mt-2 break-all font-mono text-xs text-ink-500">{payload.pixKey}</p>
              {kaminoSig && (
                <div className="mt-4 rounded-2xl bg-ink-900/60 p-3 ring-1 ring-white/5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                    Kamino on-chain
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-brand-300">
                    {kaminoSig}
                  </p>
                </div>
              )}
              <button onClick={() => router.push('/app')} className="btn-primary mt-6 w-full py-4">
                Voltar
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-300">Processando saque</p>
              <p className="mt-1 font-display text-3xl font-bold text-ink-50">
                {formatBRL(payload.amountBRL)}
              </p>
              <p className="text-xs text-ink-400">≈ {formatUSDC(payload.amountUSDC, 6)}</p>

              <div className="mt-6 space-y-3">
                <StepRow
                  label={kaminoRealMode ? 'Withdraw Kamino on-chain' : 'Retirando do Kamino'}
                  done={kaminoRealMode ? !!kaminoSig : true}
                />
                <StepRow label="Convertendo USDC → BRL" done={isPaid} active={isProcessing} />
                <StepRow label="Enviando PIX para sua chave" done={isPaid} />
              </div>

              {kaminoSig && (
                <div className="mt-4 rounded-2xl bg-ink-900/60 p-3 ring-1 ring-white/5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                    Kamino signature
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-brand-300">
                    {kaminoSig}
                  </p>
                </div>
              )}

              <div className="mt-4 rounded-2xl bg-ink-900/60 p-3 ring-1 ring-white/5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                  Destino
                </p>
                <p className="mt-1 break-all font-mono text-xs text-ink-200">{payload.pixKey}</p>
              </div>

              {IS_MOCK && (
                <button
                  onClick={simulatePayment}
                  className="mt-4 w-full rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs font-medium text-amber-300 hover:bg-amber-500/10"
                >
                  🧪 Simular confirmação PIX · mock
                </button>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}

function StepRow({ label, done, active }: { label: string; done: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs transition ${
          done
            ? 'bg-brand-500 text-white shadow-glow'
            : active
              ? 'animate-pulse-soft bg-amber-400 text-ink-950'
              : 'bg-ink-700 text-ink-500'
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : active ? '…' : ''}
      </div>
      <span className={`text-sm ${done ? 'text-ink-100' : 'text-ink-400'}`}>{label}</span>
    </div>
  );
}
