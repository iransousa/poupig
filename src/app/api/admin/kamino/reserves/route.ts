import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role';
import { getKaminoConfig } from '@/lib/kamino';

export type ReserveOut = {
  symbol: string;
  mint: string;
  address: string;
  supplyApy: number;
  tvl: number | null;
  utilization: number | null;
  label: string;
  logoUrl?: string;
};

const MOCK_RESERVES: ReserveOut[] = [
  {
    symbol: 'USDC',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    address: 'd4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q',
    supplyApy: 6.25,
    tvl: 189_400_000,
    utilization: 0.76,
    label: 'USDC Main Market',
    logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  {
    symbol: 'USDT',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    address: 'H3t6qZ1JkguCNTi9uzVKqQ7dvt2oem7tERwGjA7L6Qux',
    supplyApy: 5.92,
    tvl: 48_200_000,
    utilization: 0.71,
    label: 'USDT Main Market',
  },
  {
    symbol: 'PYUSD',
    mint: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
    address: 'FLxzgGi9FStRMuKeN83ZvMaqf1ZUiJvXXPcK8J8C4Lh',
    supplyApy: 7.43,
    tvl: 12_800_000,
    utilization: 0.58,
    label: 'PYUSD Main Market',
  },
  {
    symbol: 'SOL',
    mint: 'So11111111111111111111111111111111111111112',
    address: 'd4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q',
    supplyApy: 4.82,
    tvl: 92_500_000,
    utilization: 0.68,
    label: 'SOL Main Market',
  },
  {
    symbol: 'JitoSOL',
    mint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
    address: 'EVbyPKrHG6WBfm4dLxLMJpUDY43cCAcHSpV3KYjKsktW',
    supplyApy: 7.15,
    tvl: 65_300_000,
    utilization: 0.42,
    label: 'JitoSOL Liquid Staking',
  },
  {
    symbol: 'mSOL',
    mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    address: '6gTJfuPHEg6uRAU7SZi94YeBcMkoJT4gcC2Xmny5aVCR',
    supplyApy: 6.89,
    tvl: 34_600_000,
    utilization: 0.39,
    label: 'mSOL Liquid Staking',
  },
  {
    symbol: 'JLP',
    mint: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4',
    address: 'DdTmCCjv7zHRD1hJv3E8bpnSEQBzdKkzB1j9ApXX5QoP',
    supplyApy: 12.4,
    tvl: 78_100_000,
    utilization: 0.81,
    label: 'JLP (Jupiter LP)',
  },
  {
    symbol: 'BONK',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    address: 'CoFdsnQeCUyJefhKK6GQaAPT9PEx8Xcs2jejtp9jgn38',
    supplyApy: 9.1,
    tvl: 8_400_000,
    utilization: 0.54,
    label: 'BONK Reserve',
  },
];

export async function GET(req: Request) {
  const { ctx, response } = await requireRole(req, ['admin', 'support']);
  if (!ctx) return response;

  const cfg = getKaminoConfig();

  if (cfg.env === 'mock') {
    return NextResponse.json({
      env: 'mock',
      market: cfg.mainMarket,
      reserves: MOCK_RESERVES,
    });
  }

  try {
    const kit = await import('@solana/kit');
    const klend = await import('@kamino-finance/klend-sdk');
    const rpc = kit.createSolanaRpc(cfg.rpcUrl);
    const market = await klend.KaminoMarket.load(
      rpc,
      kit.address(cfg.mainMarket),
      450,
      kit.address(cfg.programId),
    );
    if (!market) throw new Error('market_not_found');

    const slot = await (rpc as unknown as { getSlot: () => { send: () => Promise<bigint> } })
      .getSlot()
      .send();

    const reserves = market
      .getReserves()
      .map((r) => {
        const anyR = r as unknown as {
          address: unknown;
          stats: {
            decimals: number;
            symbol?: string;
            mintAddress?: unknown;
            status?: number | string;
            isUIDeprecated?: boolean;
          };
          getLiquidityMint?: () => unknown;
          getTokenSymbol?: () => string;
          getTotalSupply?: () => { toNumber?: () => number; toString: () => string };
          getBorrowedAmount?: () => { toNumber?: () => number; toString: () => string };
          getDepositTvl?: () => { toNumber?: () => number; toString: () => string };
          totalSupplyAPY?: (slot: bigint) => number;
        };

        // filtro: pula reserves obsoletos/depreciados/inativos
        const status = anyR.stats?.status;
        const statusStr = typeof status === 'string' ? status : '';
        if (statusStr === 'Obsolete' || anyR.stats?.isUIDeprecated) return null;

        const symbol = anyR.getTokenSymbol?.() ?? anyR.stats?.symbol ?? 'UNKNOWN';
        const mint = String(anyR.getLiquidityMint?.() ?? anyR.stats?.mintAddress ?? '');
        const decimals = anyR.stats?.decimals ?? 6;

        let totalSupply = 0;
        let borrowedAmount = 0;
        let tvlTokens = 0;
        try {
          const ts = anyR.getTotalSupply?.();
          if (ts) totalSupply = Number(ts.toString()) / 10 ** decimals;
          const ba = anyR.getBorrowedAmount?.();
          if (ba) borrowedAmount = Number(ba.toString()) / 10 ** decimals;
          const tvl = anyR.getDepositTvl?.();
          if (tvl) tvlTokens = Number(tvl.toString()) / 10 ** decimals;
        } catch {
          // continua com zeros
        }

        const apyRaw = anyR.totalSupplyAPY?.(slot) ?? 0;
        const supplyApy = apyRaw > 1 ? apyRaw : apyRaw * 100;
        const utilization =
          totalSupply > 0 ? Math.min(borrowedAmount / totalSupply, 1) : null;

        // pula reserves vazios em prod (mais ruído que sinal)
        if (totalSupply === 0 && supplyApy === 0) return null;

        return {
          symbol,
          mint,
          address: String(anyR.address),
          supplyApy: Number(supplyApy.toFixed(4)),
          tvl: tvlTokens > 0 ? tvlTokens : totalSupply,
          utilization,
          label: `${symbol} Reserve`,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return NextResponse.json({ env: cfg.env, market: cfg.mainMarket, reserves });
  } catch (err) {
    return NextResponse.json(
      {
        env: cfg.env,
        error: 'load_failed',
        message: err instanceof Error ? err.message : 'unknown',
      },
      { status: 502 },
    );
  }
}
