import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role';
import { getKaminoConfig } from '@/lib/kamino';

export type VaultOut = {
  name: string;
  symbol: string;
  manager: string;
  address: string;
  mint: string;
  tokenSymbol: string;
  tvl: number | null;
  tvlUsd: number | null;
  apy: number;
  strategy: string;
  risk: 'low' | 'medium' | 'high';
  profile: string;
  description: string;
};

const MOCK_VAULTS: VaultOut[] = [
  {
    name: 'Sentora PYUSD',
    symbol: 'kPYUSD',
    manager: 'Sentora',
    address: 'kPYUSDvau1tZB2qz1nCkqnd5ZpLEe8fFGpT8k9c3P9bQ',
    mint: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
    tokenSymbol: 'PYUSD',
    tvl: 223_760_000,
    tvlUsd: 223_760_000,
    apy: 10.32,
    strategy: 'Multi-reserve PYUSD allocation',
    risk: 'medium',
    profile: 'Balanced',
    description: 'Yield agressivo em PYUSD via curadoria Sentora',
  },
  {
    name: 'Steakhouse USDC',
    symbol: 'kUSDC-Steak',
    manager: 'Steakhouse',
    address: 'kUSDCSteakvau1tAvg5eR3cRWfXCUmkHKyHTe3JjxPpY5w',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    tokenSymbol: 'USDC',
    tvl: 29_200_000,
    tvlUsd: 29_200_000,
    apy: 9.8,
    strategy: 'Conservative USDC across battle-tested reserves',
    risk: 'low',
    profile: 'Conservative',
    description: 'Curadoria Steakhouse com foco em capital preservation',
  },
  {
    name: 'RockawayX RWA USDC',
    symbol: 'kUSDC-RWA',
    manager: 'RockawayX',
    address: 'kUSDCRwavau1tCxH3v5DnyH7cZEZgJm8bG4uWqX9Yz1sR',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    tokenSymbol: 'USDC',
    tvl: 27_400_000,
    tvlUsd: 27_400_000,
    apy: 9.22,
    strategy: 'Real-world asset backed loops',
    risk: 'medium',
    profile: 'Balanced',
    description: 'Yield com colateral RWA tokenizado',
  },
  {
    name: 'CASH Earn',
    symbol: 'kCASH',
    manager: 'Gauntlet',
    address: 'kCASHvau1tEjH6bYYK3nVpR2vGxqLJkHAT9qzNwSVPqzK',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    tokenSymbol: 'USDC',
    tvl: 17_750_000,
    tvlUsd: 17_750_000,
    apy: 5.84,
    strategy: 'Auto-allocated low-risk USDC',
    risk: 'low',
    profile: 'Balanced',
    description: 'Vault gerido por Gauntlet com risk management ativo',
  },
  {
    name: 'Allez USDC',
    symbol: 'kUSDC-Allez',
    manager: 'Allez Labs',
    address: 'kAllezvau1tP7kJQzXcNDxmZbE3tK7XF9rRpZYtQnMCpa',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    tokenSymbol: 'USDC',
    tvl: 14_070_000,
    tvlUsd: 14_070_000,
    apy: 9.43,
    strategy: 'Aggressive yield USDC',
    risk: 'medium',
    profile: 'Balanced',
    description: 'Curadoria Allez com rebalance agressivo',
  },
  {
    name: 'JLP Boost',
    symbol: 'kJLP',
    manager: 'Sentora',
    address: 'kJLPvau1tZB2qz1nCkqnd5ZpLEe8fFGpT8k9c3P9bQfd',
    mint: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
    tokenSymbol: 'JLP',
    tvl: 56_200_000,
    tvlUsd: 56_200_000,
    apy: 14.8,
    strategy: 'Leveraged JLP with hedged exposure',
    risk: 'high',
    profile: 'Balanced',
    description: 'Amplifica yield JLP com alavancagem',
  },
];

const KNOWN_TOKEN_SYMBOLS: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
  '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo': 'PYUSD',
  So11111111111111111111111111111111111111112: 'SOL',
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: 'JitoSOL',
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: 'mSOL',
  '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4': 'JLP',
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 'BONK',
};

function decodeName(bytes: number[] | undefined): string {
  if (!bytes) return '';
  return Buffer.from(bytes.filter((b) => b !== 0))
    .toString('utf8')
    .trim();
}

function inferRisk(performanceFeeBps: number): 'low' | 'medium' | 'high' {
  if (performanceFeeBps <= 500) return 'low';
  if (performanceFeeBps <= 1500) return 'medium';
  return 'high';
}

function inferProfile(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('conservative') || n.includes('steakhouse') || n.includes('cash')) {
    return 'Conservative';
  }
  if (n.includes('multiply') || n.includes('lev') || n.includes('boost')) return 'Boosted';
  return 'Balanced';
}

export async function GET(req: Request) {
  const { ctx, response } = await requireRole(req, ['admin', 'support']);
  if (!ctx) return response;

  const cfg = getKaminoConfig();

  if (cfg.env === 'mock') {
    return NextResponse.json({ env: 'mock', vaults: MOCK_VAULTS });
  }

  try {
    const kit = await import('@solana/kit');
    const klend = await import('@kamino-finance/klend-sdk');
    const rpc = kit.createSolanaRpc(cfg.rpcUrl);

    const anyKlend = klend as unknown as {
      KaminoVaultClient: new (
        rpc: unknown,
        recentSlotDurationMs: number,
        kvaultProgramId?: unknown,
      ) => {
        getAllVaults: () => Promise<
          Array<{
            address: unknown;
            tokenMint: unknown;
            name: string;
            state: {
              prevAumSf?: { toString: () => string };
              tokenAvailable?: { toString: () => string };
              sharesIssued?: { toString: () => string };
              tokenMintDecimals?: { toString: () => string };
              performanceFeeBps?: { toString: () => string };
              managementFeeBps?: { toString: () => string };
              name?: number[];
            } | null;
          }>
        >;
      };
    };

    const vaultClient = new anyKlend.KaminoVaultClient(rpc, 450);
    const allVaults = await vaultClient.getAllVaults();

    const parsed: VaultOut[] = [];
    for (const v of allVaults) {
      const state = v.state;
      if (!state) continue;
      const decimals = state.tokenMintDecimals
        ? Number(state.tokenMintDecimals.toString())
        : 6;
      const aumSf = state.prevAumSf ? Number(state.prevAumSf.toString()) : 0;
      const tvlTokens = aumSf > 0 ? aumSf / 2 ** 60 / 10 ** decimals : 0;
      if (tvlTokens <= 0) continue;

      const mintStr = String(v.tokenMint);
      const tokenSymbol = KNOWN_TOKEN_SYMBOLS[mintStr] ?? 'UNKNOWN';
      const rawName = v.name?.trim() || decodeName(state.name) || `${tokenSymbol} Vault`;
      const perfBps = state.performanceFeeBps
        ? Number(state.performanceFeeBps.toString())
        : 0;
      const manager = rawName.split(/\s+/)[0] ?? 'Anonymous';

      parsed.push({
        name: rawName,
        symbol: `k${tokenSymbol}`,
        manager,
        address: String(v.address),
        mint: mintStr,
        tokenSymbol,
        tvl: tvlTokens,
        tvlUsd: null,
        apy: 0,
        strategy: 'Multi-reserve allocation',
        risk: inferRisk(perfBps),
        profile: inferProfile(rawName),
        description: `Vault Kamino Lend gerido por ${manager}`,
      });
    }
    parsed.sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0));

    return NextResponse.json({
      env: cfg.env,
      vaults: parsed,
      note:
        'TVL on-chain via prevAumSf. APY exige getVaultOverview() por vault (custoso) — fica em 0% no listing.',
    });
  } catch (err) {
    console.error('[admin/kamino/vaults] failed', err);
    return NextResponse.json(
      {
        env: cfg.env,
        vaults: [],
        error: err instanceof Error ? err.message : 'unknown',
      },
      { status: 502 },
    );
  }
}
