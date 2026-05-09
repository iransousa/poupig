'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Toaster } from 'sonner';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

const KAMINO_ENV = process.env.NEXT_PUBLIC_KAMINO_ENV ?? 'mock';
const CUSTOM_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;

function buildSolanaRpcs() {
  const mainnetHttp = CUSTOM_RPC ?? 'https://api.mainnet-beta.solana.com';
  const mainnetWs =
    CUSTOM_RPC && CUSTOM_RPC.startsWith('https://')
      ? CUSTOM_RPC.replace(/^https:\/\//, 'wss://')
      : 'wss://api.mainnet-beta.solana.com';
  const rpcs: Record<string, { rpc: unknown; rpcSubscriptions: unknown }> = {
    'solana:mainnet': {
      rpc: createSolanaRpc(mainnetHttp),
      rpcSubscriptions: createSolanaRpcSubscriptions(mainnetWs),
    },
  };
  if (KAMINO_ENV === 'devnet') {
    rpcs['solana:devnet'] = {
      rpc: createSolanaRpc('https://api.devnet.solana.com'),
      rpcSubscriptions: createSolanaRpcSubscriptions('wss://api.devnet.solana.com'),
    };
  }
  return rpcs;
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
  const solanaRpcs = useMemo(() => buildSolanaRpcs(), []);

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'google'],
        appearance: {
          theme: 'dark',
          accentColor: '#a855f7',
          logo: undefined,
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors() },
        },
        solana: {
          rpcs: solanaRpcs as never,
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          theme="dark"
          richColors
          position="top-center"
          toastOptions={{
            style: {
              background: '#181823',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#f5f5fa',
            },
          }}
        />
      </QueryClientProvider>
    </PrivyProvider>
  );
}
