'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { ArrowLeft, Check, Copy, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { formatBRL, formatUSDC, formatUSD } from '@/lib/utils';
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
      toast.success('🐷 PIX gerado! Pague no seu banco.');
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
    <main className="mx-auto max-w-lg px-5 pb-16 pt-6">
      <header className="mb-5 flex items-center gap-3">
        <a
          href="/app"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-2 text-fg-mid ring-1 ring-line hover:bg-bg-3"
        >
          <ArrowLeft className="h-4 w-4" />
        </a>
        <h1 className="text-h2 text-fg">Depositar</h1>
        <div className="ml-auto">
          <EnvBadge />
        </div>
      </header>

      {!payload && (
        <section className="card animate-slide-up">
          <label className="block">
            <span className="label-field">Valor em reais</span>
            <div className="flex items-center rounded-[14px] border border-line bg-bg-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
              <span className="pl-4 text-fg-mid">R$</span>
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
                className="w-full rounded-[14px] bg-transparent px-2 py-3.5 text-h3 font-semibold text-fg focus:outline-none"
              />
            </div>
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
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
            <div className="mt-4 flex items-center gap-2 rounded-[14px] bg-accent-soft p-3 text-[13px] text-accent ring-1 ring-accent/20">
              <Sparkles className="h-4 w-4" />
              <div>
                Você recebe <strong>{formatUSD(quote.amountOut, 4)}</strong>
                <span className="ml-2 text-[11px] text-fg-mid">
                  a {formatBRL(quote.rate)}/USDC
                </span>
              </div>
            </div>
          )}

          <button
            onClick={createDeposit}
            disabled={creating || !amount || Number(amount) <= 0}
            className="btn-primary mt-6 w-full"
          >
            {creating ? 'Gerando PIX...' : 'Gerar PIX'}
          </button>

          {IS_MOCK && (
            <p className="mt-3 text-center text-[11px] text-warning/80">
              Modo MOCK · PIX simulado, sem cobrança real
            </p>
          )}
          {KAMINO_REAL && (
            <p className="mt-1 text-center text-[11px] text-accent">
              Kamino {KAMINO_ENV} · depósito on-chain real após pagamento
            </p>
          )}
        </section>
      )}

      {payload && (
        <section className="card animate-slide-up">
          {isPaid ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft text-accent shadow-accent">
                <Check className="h-10 w-10" strokeWidth={3} />
              </div>
              <h2 className="text-h2 text-fg">Pagamento confirmado!</h2>
              <p className="mt-1 text-[13px] text-fg-mid">
                {formatUSD(payload.amountUSDC, 2)} chegou na sua carteira.
              </p>

              {KAMINO_REAL && !onChainSig && (
                <button
                  onClick={signKaminoDeposit}
                  disabled={signing}
                  className="btn-primary mt-6 w-full"
                >
                  {signing ? 'Assinando...' : `Aplicar no Kamino (${KAMINO_ENV})`}
                </button>
              )}
              {onChainSig && (
                <div className="mt-4 rounded-[14px] bg-bg-2 p-3 ring-1 ring-line">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">
                    Kamino signature
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-accent">{onChainSig}</p>
                </div>
              )}

              <a href="/app" className="btn-secondary mt-4 w-full">
                Voltar
              </a>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-fg-mid">Escaneie ou copie o código PIX</p>
              <p className="mt-1 text-display tracking-tight text-fg">
                {formatBRL(payload.amountBRL)}
              </p>
              <p className="text-[11px] text-fg-dim">≈ {formatUSDC(payload.amountUSDC, 6)}</p>

              <div className="mt-6 flex justify-center rounded-[20px] bg-white p-6">
                <QRCodeSVG value={payload.pixCopiaECola} size={200} level="M" />
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-[14px] bg-warning/10 p-3 ring-1 ring-warning/20">
                <span className="text-warning">⚠️</span>
                <p className="text-[12px] text-warning">
                  Pague exatamente <strong>{formatBRL(payload.amountBRL)}</strong>. Valor
                  diferente pode ficar pendente na 4P.
                </p>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(payload.pixCopiaECola);
                  toast.success('Copiado!');
                }}
                className="btn-secondary mt-4 w-full"
              >
                <Copy className="h-4 w-4" />
                Copiar código PIX
              </button>

              <div className="mt-4 flex items-center justify-center gap-2 text-[13px]">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isPending ? 'animate-pulse-soft bg-warning' : 'bg-bg-3'
                  }`}
                />
                <span className="text-fg-mid">
                  {isPending ? 'Aguardando pagamento...' : status ?? 'Aguardando'}
                </span>
              </div>

              {IS_MOCK && (
                <button
                  onClick={simulatePayment}
                  className="mt-4 w-full rounded-full border border-dashed border-warning/30 bg-warning/5 px-4 py-2.5 text-[12px] font-medium text-warning hover:bg-warning/10"
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
