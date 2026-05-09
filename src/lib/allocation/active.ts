import { asc, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { allocationStrategies, allocationTargets } from '@/lib/db/schema';
import { getKaminoConfig } from '@/lib/kamino';

export type ActiveTarget = {
  id: string;
  kind: 'reserve' | 'vault';
  label: string;
  marketPubkey: string;
  targetPubkey: string;
  mintPubkey: string;
  symbol: string;
  weightBps: number;
};

export type ActiveAllocation = {
  strategyId: string;
  strategyName: string;
  targets: ActiveTarget[];
};

/**
 * Retorna a estratégia ativa (ou null se nenhuma). Se mais de uma estiver marcada,
 * pega a mais recentemente ativada.
 */
export async function loadActiveAllocation(): Promise<ActiveAllocation | null> {
  const [strat] = await db
    .select()
    .from(allocationStrategies)
    .where(isNotNull(allocationStrategies.active))
    .orderBy(asc(allocationStrategies.active))
    .limit(1);
  if (!strat) return null;

  const targets = await db
    .select()
    .from(allocationTargets)
    .where(eq(allocationTargets.strategyId, strat.id))
    .orderBy(asc(allocationTargets.createdAt));

  if (targets.length === 0) return null;

  return {
    strategyId: strat.id,
    strategyName: strat.name,
    targets: targets.map((t) => ({
      id: t.id,
      kind: t.kind,
      label: t.label,
      marketPubkey: t.marketPubkey,
      targetPubkey: t.targetPubkey,
      mintPubkey: t.mintPubkey,
      symbol: t.symbol,
      weightBps: t.weightBps,
    })),
  };
}

/**
 * Distribui `amountUSDC` entre os targets conforme weight_bps.
 * Retorna uma lista de `{target, amountUSDC}`.
 */
export function splitAmount(
  amountUSDC: number,
  targets: ActiveTarget[],
): Array<{ target: ActiveTarget; amountUSDC: number }> {
  const totalBps = targets.reduce((s, t) => s + t.weightBps, 0);
  if (totalBps === 0) return [];
  const splits = targets.map((t) => ({
    target: t,
    amountUSDC: Number(((amountUSDC * t.weightBps) / totalBps).toFixed(6)),
  }));
  // garante soma não passa do total por arredondamento
  const sum = splits.reduce((s, r) => s + r.amountUSDC, 0);
  if (sum > amountUSDC) {
    splits[splits.length - 1].amountUSDC -= Number((sum - amountUSDC).toFixed(6));
  }
  return splits;
}

export function defaultFallbackTarget(): ActiveTarget {
  const cfg = getKaminoConfig();
  return {
    id: 'default',
    kind: 'reserve',
    label: 'USDC Main Market (default)',
    marketPubkey: cfg.mainMarket,
    targetPubkey: cfg.mainMarket,
    mintPubkey: cfg.usdcMint,
    symbol: 'USDC',
    weightBps: 10000,
  };
}
