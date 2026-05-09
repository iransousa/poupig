'use client';

import { useSolanaWallets, useSendTransaction } from '@privy-io/react-auth/solana';
import { VersionedTransaction, Connection } from '@solana/web3.js';
import { useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';

type KaminoConfig = {
  env: string;
  cluster: string;
  programId: string;
  mainMarket: string;
  usdcMint: string;
  explorerBase: string;
};

function clusterRpcUrl(cluster: string) {
  if (cluster === 'devnet') return 'https://api.devnet.solana.com';
  return process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
}

export function useKaminoSigning() {
  const { wallets } = useSolanaWallets();
  const { sendTransaction } = useSendTransaction();

  const signAndConfirm = useCallback(
    async (
      path: 'prepare-deposit' | 'prepare-withdraw',
      confirmPath: 'confirm-deposit' | 'confirm-withdraw',
      opts: { amountUSDC: number; transactionId?: string },
    ): Promise<{ signature: string }> => {
      const wallet = wallets[0];
      if (!wallet) throw new Error('Privy Solana wallet not ready');

      const prepared = await apiFetch<{
        txBase64: string;
        env: string;
        cluster: string;
      }>(`/api/kamino/${path}`, {
        method: 'POST',
        body: JSON.stringify({ amountUSDC: opts.amountUSDC }),
      });

      const cfg = await apiFetch<KaminoConfig>('/api/kamino/config');
      const rpcUrl = clusterRpcUrl(cfg.cluster);

      const bytes = Uint8Array.from(Buffer.from(prepared.txBase64, 'base64'));
      const tx = VersionedTransaction.deserialize(bytes);
      const connection = new Connection(rpcUrl, 'confirmed');

      const receipt = await sendTransaction({
        transaction: tx,
        connection,
        address: wallet.address,
      });

      const signature =
        typeof receipt === 'string' ? receipt : (receipt as { signature: string }).signature;

      await apiFetch(`/api/kamino/${confirmPath}`, {
        method: 'POST',
        body: JSON.stringify({
          signature,
          amountUSDC: opts.amountUSDC,
          transactionId: opts.transactionId,
        }),
      });

      return { signature };
    },
    [wallets, sendTransaction],
  );

  return { signAndConfirm };
}
