'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { ArrowLeft, Check, Copy, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { formatBRL, formatUSDC } from '@/lib/utils';
import { useTransaction } from '@/hooks/use-transaction';
import { useKaminoSigning } from '@/hooks/use-kamino-signing';
import { EnvBadge } from '@/components/env-badge';

type QuoteResponse = {
  from: string;
  to: string;
  amountIn: number;
  amountOut: number;
  rate: number;
};

type DepositCreated = {
  id: string;
  status: string;
  amountBRL: number;
  amountUSDC: number;
  pixCopiaECola: string;
  pixChave: string;
  expiresAt: string;
};

const IS_MOCK = process.env.NEXT_PUBLIC_FOUR_P_DRIVER === 'mock';
const KAMINO_ENV = process.env.NEXT_PUBLIC_KAMINO_ENV ?? 'mock';
const KAMINO_REAL = KAMINO_ENV !== 'mock';

export default function DepositPage() {
  const [amount, setAmount] = useState('100');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [signing, setSigning] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [payload, setPayload] = useState<DepositCreated | null>(null);
  const [onChainSig, setOnChainSig] = useState<string | null>(null);

  const { data: tx } = useTransaction(txId);
  const { signAndConfirm } = useKaminoSigning();

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

  async function createDeposit() {
    setCreating(true);
    try {
      const res = await apiFetch<DepositCreated>('/api/deposit/create', {
        method: 'POST',
        body: JSON.stringify({ amountBRL: Number(amount) }),
      });
      setPayload(res);
      setTxId(res.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar depósito');
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
      toast.success('Pagamento simulado!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function signKaminoDeposit() {
    if (!txId || !payload) return;
    setSigning(true);
    try {
      const { signature } = await signAndConfirm('prepare-deposit', 'confirm-deposit', {
        amountUSDC: payload.amountUSDC,
        transactionId: txId,
      });
      setOnChainSig(signature);
      toast.success(`Depositado no Kamino!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao assinar');
    } finally {
      setSigning(false);
    }
  }

  const status = tx?.status ?? payload?.status ?? null;
  const isPaid = status === 'paid';
  const isPending = status === 'pending' || status === 'processing';

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 pb-16 pt-6">
      <header className="mb-6 flex items-center gap-3">
        <a
          href="/app"
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink-800/60 text-ink-300 ring-1 ring-white/5 hover:bg-ink-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </a>
        <h1 className="font-display text-2xl font-bold text-ink-50">Depositar</h1>
        <div className="ml-auto">
          <EnvBadge />
        </div>
      </header>

      {!payload && (
        <section className="card animate-slide-up">
          <label className="block">
            <span className="label-field">Valor em reais</span>
            <div className="flex items-center rounded-2xl border border-ink-700 bg-ink-900/60 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30">
              <span className="pl-4 text-ink-400">R$</span>
              <input
                type="number"
                min="1"
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
            {['50', '100', '250', '500'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setAmount(v);
                  setQuote(null);
                }}
                className="btn-pill"
              >
                R$ {v}
              </button>
            ))}
          </div>

          {quote && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-brand-500/10 p-3 text-sm text-brand-200 ring-1 ring-brand-500/20">
              <Sparkles className="h-4 w-4" />
              <div>
                Você recebe <strong>{formatUSDC(quote.amountOut, 6)}</strong>
                <span className="ml-2 text-xs text-ink-400">
                  a {formatBRL(quote.rate)}/USDC
                </span>
              </div>
            </div>
          )}

          <button
            onClick={createDeposit}
            disabled={creating || !amount || Number(amount) <= 0}
            className="btn-primary mt-6 w-full py-4 text-base"
          >
            {creating ? 'Gerando PIX...' : 'Gerar PIX'}
          </button>

          {IS_MOCK && (
            <p className="mt-3 text-center text-xs text-amber-300/80">
              Modo MOCK · PIX simulado, sem cobrança real
            </p>
          )}
          {KAMINO_REAL && (
            <p className="mt-1 text-center text-xs text-brand-300">
              Kamino {KAMINO_ENV} · depósito on-chain real após pagamento
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
              <h2 className="font-display text-2xl font-bold text-ink-50">
                Pagamento confirmado!
              </h2>
              <p className="mt-1 text-sm text-ink-300">
                {formatUSDC(payload.amountUSDC, 2)} chegou na sua carteira.
              </p>

              {KAMINO_REAL && !onChainSig && (
                <button
                  onClick={signKaminoDeposit}
                  disabled={signing}
                  className="btn-primary mt-6 w-full py-4"
                >
                  {signing ? 'Assinando...' : `Aplicar no Kamino (${KAMINO_ENV})`}
                </button>
              )}
              {onChainSig && (
                <div className="mt-4 rounded-2xl bg-ink-900/60 p-3 ring-1 ring-white/5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
                    Kamino signature
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-brand-300">
                    {onChainSig}
                  </p>
                </div>
              )}

              <a href="/app" className="btn-ghost mt-4 w-full py-3.5">
                Voltar
              </a>
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-300">Escaneie ou copie o código PIX</p>
              <p className="mt-1 font-display text-3xl font-bold text-ink-50">
                {formatBRL(payload.amountBRL)}
              </p>
              <p className="text-xs text-ink-400">≈ {formatUSDC(payload.amountUSDC, 6)}</p>

              <div className="mt-6 flex justify-center rounded-3xl bg-white p-6">
                <QRCodeSVG value={payload.pixCopiaECola} size={200} level="M" />
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(payload.pixCopiaECola);
                  toast.success('Copiado!');
                }}
                className="btn-ghost mt-4 w-full py-3.5"
              >
                <Copy className="h-4 w-4" />
                Copiar código PIX
              </button>

              <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isPending ? 'animate-pulse-soft bg-amber-400' : 'bg-ink-600'
                  }`}
                />
                <span className="text-ink-300">
                  {isPending ? 'Aguardando pagamento...' : status ?? 'Aguardando'}
                </span>
              </div>

              {IS_MOCK && (
                <button
                  onClick={simulatePayment}
                  className="mt-4 w-full rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs font-medium text-amber-300 hover:bg-amber-500/10"
                >
                  🧪 Simular pagamento · mock
                </button>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
