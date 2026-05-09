'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Droplet, Copy, ExternalLink, AlertTriangle } from 'lucide-react';
import { useKaminoPreflight, useKaminoConfig } from '@/hooks/use-kamino-config';
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
    <div className="mb-4 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
        <div className="flex-1 space-y-3">
          {!pre.hasSol && (
            <div className="space-y-2">
              <p className="text-xs text-amber-200">
                Precisa de <strong>{pre.minSolRecommended} SOL</strong> pra pagar gas (atual:{' '}
                {(pre.solLamports / 1e9).toFixed(4)} SOL)
              </p>
              {isDevnet && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={requestSol}
                    disabled={airdropping}
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    <Droplet className="h-3.5 w-3.5" />
                    {airdropping ? 'Solicitando...' : 'Pedir 1 SOL'}
                  </button>
                  <a
                    href={SOLANA_FAUCET}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-transparent px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/10"
                  >
                    Faucet alternativo <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {!pre.hasUsdc && (
            <div className="space-y-2">
              <p className="text-xs text-amber-200">
                Sem USDC {cfg?.cluster} na wallet. Use a faucet da Circle:
              </p>
              {isDevnet && wallet && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-ink-950/40 px-2 py-1.5 font-mono text-[10px] text-amber-100 ring-1 ring-amber-500/20">
                    {wallet}
                  </code>
                  <button
                    onClick={copyWallet}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 px-2 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/10"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              )}
              <a
                href={CIRCLE_FAUCET}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-amber-400"
              >
                Circle Faucet <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
