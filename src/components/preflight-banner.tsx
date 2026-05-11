'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Copy, Droplet, ExternalLink } from 'lucide-react';
import { useKaminoConfig, useKaminoPreflight } from '@/hooks/use-kamino-config';
import { useMe } from '@/hooks/use-me';
import { apiFetch } from '@/lib/api/client';

const CIRCLE_FAUCET = 'https://faucet.circle.com/';
const SOLANA_FAUCET = 'https://faucet.solana.com/';

export function PreflightBanner() {
  const { data: cfg } = useKaminoConfig();
  const realMode = cfg?.env && cfg.env !== 'mock';
  const { data: pre } = useKaminoPreflight(Boolean(realMode));
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [airdropping, setAirdropping] = useState(false);

  if (!realMode || !pre || (pre.hasSol && pre.hasUsdc)) return null;

  const isDevnet = cfg?.cluster === 'devnet';
  const isMainnet = cfg?.cluster === 'mainnet-beta';
  const wallet = me?.solanaWalletAddress ?? '';

  async function requestSol() {
    setAirdropping(true);
    try {
      const res = await apiFetch<{ signature: string }>('/api/dev/airdrop-sol', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success(`1 SOL devnet enviado! ${res.signature.slice(0, 8)}...`);
      setTimeout(() => qc.invalidateQueries({ queryKey: ['kamino-preflight'] }), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro');
    } finally {
      setAirdropping(false);
    }
  }

  function copyWallet() {
    if (!wallet) return;
    navigator.clipboard.writeText(wallet);
    toast.success('Endereço copiado!');
  }

  return (
    <div className="mb-4 rounded-[20px] border border-warning/20 bg-warning/10 p-4 text-[13px] text-warning">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="flex-1 space-y-3">
          {!pre.hasSol && (
            <div className="space-y-2">
              <p className="text-[12px] opacity-90">
                Precisa de <strong>{pre.minSolRecommended} SOL</strong>{' '}
                {isMainnet ? 'mainnet' : 'devnet'} pra pagar gas (atual:{' '}
                {(pre.solLamports / 1e9).toFixed(4)} SOL)
              </p>
              {isDevnet ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={requestSol}
                    disabled={airdropping}
                    className="inline-flex items-center gap-1.5 rounded-full bg-warning px-3 py-1.5 text-[12px] font-semibold text-bg-0 hover:opacity-90 disabled:opacity-50"
                  >
                    <Droplet className="h-3.5 w-3.5" />
                    {airdropping ? 'Solicitando...' : 'Pedir 1 SOL'}
                  </button>
                  <a
                    href={SOLANA_FAUCET}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-transparent px-3 py-1.5 text-[12px] font-medium hover:bg-warning/10"
                  >
                    Faucet alternativo <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <p className="text-[11px] opacity-75">
                  Transfira SOL real (qualquer corretora ou wallet) pro endereço abaixo.
                </p>
              )}
            </div>
          )}

          {!pre.hasUsdc && (
            <div className="space-y-2">
              <p className="text-[12px] opacity-90">
                Sem USDC {isMainnet ? 'mainnet' : 'devnet'} na sua wallet.
                {isMainnet
                  ? ' Transfira USDC de uma exchange (Binance, MercadoBitcoin, etc) ou outra wallet.'
                  : ' Use a faucet da Circle:'}
              </p>
              {wallet && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-[10px] bg-bg-0/40 px-2 py-1.5 font-mono text-[10px] ring-1 ring-warning/20">
                    {wallet}
                  </code>
                  <button
                    onClick={copyWallet}
                    className="inline-flex items-center gap-1 rounded-full border border-warning/30 px-2 py-1.5 text-[12px] font-medium hover:bg-warning/10"
                    title="Copiar endereço"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              )}
              {isDevnet && (
                <a
                  href={CIRCLE_FAUCET}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-warning px-3 py-1.5 text-[12px] font-semibold text-bg-0 hover:opacity-90"
                >
                  Circle Faucet <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {isMainnet && (
                <p className="text-[11px] opacity-75">
                  Mint USDC mainnet: <code className="font-mono">EPjFWdd5...zwyTDt1v</code> · Rede
                  Solana
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
