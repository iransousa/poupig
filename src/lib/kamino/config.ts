import { env } from '@/env';

export type KaminoEnv = 'mock' | 'staging' | 'mainnet';

export type KaminoConfig = {
  env: KaminoEnv;
  rpcUrl: string;
  programId: string;
  mainMarket: string;
  usdcMint: string;
  cluster: 'mainnet-beta' | 'devnet';
  explorerBase: string;
};

const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Kamino Lend só tem mainnet e staging — ambos usam o cluster mainnet-beta.
// devnet oficial não existe pra Kamino Lend (só pra Kamino Vaults, produto diferente).
const PRESETS: Record<Exclude<KaminoEnv, 'mock'>, Omit<KaminoConfig, 'env' | 'rpcUrl'>> = {
  mainnet: {
    programId: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD',
    mainMarket: '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
    usdcMint: USDC_MAINNET,
    cluster: 'mainnet-beta',
    explorerBase: 'https://solscan.io',
  },
  staging: {
    programId: 'SLendK7ySfcEzyaFqy93gDnD3RtrpXJcnRwb6zFHJSh',
    // Staging compartilha o mesmo main market da mainnet (mesmo cluster mainnet-beta)
    mainMarket: '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
    usdcMint: USDC_MAINNET,
    cluster: 'mainnet-beta',
    explorerBase: 'https://solscan.io',
  },
};

export function getKaminoConfig(): KaminoConfig {
  const raw = (env.KAMINO_ENV ?? 'mock') as string;
  // legado: usuário que tenha "devnet" no env cai em mock com warning
  if (raw === 'devnet') {
    console.warn(
      '[kamino config] KAMINO_ENV=devnet não é suportado (Kamino Lend só tem mainnet e staging). ' +
        'Usando mock. Troque para KAMINO_ENV=staging para testar real com valores pequenos.',
    );
  }
  const e = (raw === 'mainnet' || raw === 'staging' ? raw : 'mock') as KaminoEnv;
  if (e === 'mock') {
    return {
      env: 'mock',
      rpcUrl: 'mock',
      programId: 'mock',
      mainMarket: 'mock',
      usdcMint: USDC_MAINNET,
      cluster: 'mainnet-beta',
      explorerBase: 'https://solscan.io',
    };
  }
  const preset = PRESETS[e];
  const rpcUrl = env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return {
    env: e,
    rpcUrl,
    programId: env.KAMINO_PROGRAM_ID || preset.programId,
    mainMarket: env.KAMINO_MARKET_PUBKEY || preset.mainMarket,
    usdcMint: preset.usdcMint,
    cluster: preset.cluster,
    explorerBase: preset.explorerBase,
  };
}

export function explorerUrl(signature: string) {
  const cfg = getKaminoConfig();
  const cluster = cfg.cluster === 'devnet' ? '?cluster=devnet' : '';
  return `${cfg.explorerBase}/tx/${signature}${cluster}`;
}
