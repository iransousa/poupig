import { NextResponse } from 'next/server';
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/require-role';
import { db } from '@/lib/db/client';
import { users, kaminoPositions, transactions } from '@/lib/db/schema';
import { fourP } from '@/lib/four-p';

export async function GET(req: Request) {
  const { ctx, response } = await requireRole(req, ['admin', 'support']);
  if (!ctx) return response;

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400 * 1000);
  const d30 = new Date(now.getTime() - 30 * 86400 * 1000);

  const [usersAgg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      newLast7: sql<number>`count(*) filter (where created_at >= ${d7})::int`,
      newLast30: sql<number>`count(*) filter (where created_at >= ${d30})::int`,
      onboarded: sql<number>`count(*) filter (where onboarded_at is not null)::int`,
    })
    .from(users);

  const [positionsAgg] = await db
    .select({
      tvlUsdc: sql<string>`coalesce(sum(${kaminoPositions.usdcCurrentValue}), 0)`,
      principalUsdc: sql<string>`coalesce(sum(${kaminoPositions.usdcSupplied}), 0)`,
      activeUsers: sql<number>`count(*) filter (where ${kaminoPositions.usdcCurrentValue} > 0)::int`,
      avgApyWeighted: sql<string>`
        coalesce(
          sum(${kaminoPositions.currentApy} * ${kaminoPositions.usdcCurrentValue})
            / nullif(sum(${kaminoPositions.usdcCurrentValue}), 0),
          0
        )
      `,
    })
    .from(kaminoPositions);

  const [txVol7] = await db
    .select({
      depositsBrl: sql<string>`coalesce(sum(${transactions.amountBrl}) filter (where ${transactions.kind} = 'onramp' and ${transactions.status} = 'paid'), 0)`,
      withdrawsBrl: sql<string>`coalesce(sum(${transactions.amountBrl}) filter (where ${transactions.kind} = 'offramp' and ${transactions.status} = 'paid'), 0)`,
      failures: sql<number>`count(*) filter (where ${transactions.status} = 'error')::int`,
      pending: sql<number>`count(*) filter (where ${transactions.status} in ('pending','processing'))::int`,
    })
    .from(transactions)
    .where(gte(transactions.createdAt, d7));

  const [txVol30] = await db
    .select({
      depositsBrl: sql<string>`coalesce(sum(${transactions.amountBrl}) filter (where ${transactions.kind} = 'onramp' and ${transactions.status} = 'paid'), 0)`,
      withdrawsBrl: sql<string>`coalesce(sum(${transactions.amountBrl}) filter (where ${transactions.kind} = 'offramp' and ${transactions.status} = 'paid'), 0)`,
    })
    .from(transactions)
    .where(gte(transactions.createdAt, d30));

  const tvlUsdc = Number(positionsAgg.tvlUsdc);
  const principalUsdc = Number(positionsAgg.principalUsdc);

  let tvlBrl = 0;
  let usdcBrlRate = 0;
  if (tvlUsdc > 0) {
    try {
      const q = await fourP.priceConversion({
        amount: tvlUsdc.toString(),
        from: 'USDC',
        to: 'BRL',
      });
      tvlBrl = Number(q.info.data.amount);
      usdcBrlRate = Number(q.info.data.quote.price);
    } catch {
      tvlBrl = 0;
    }
  }

  return NextResponse.json({
    users: {
      total: usersAgg.total,
      onboarded: usersAgg.onboarded,
      newLast7: usersAgg.newLast7,
      newLast30: usersAgg.newLast30,
      activeWithPosition: positionsAgg.activeUsers,
    },
    tvl: {
      usdc: Number(tvlUsdc.toFixed(6)),
      brl: Number(tvlBrl.toFixed(2)),
      principalUsdc: Number(principalUsdc.toFixed(6)),
      yieldUsdc: Number((tvlUsdc - principalUsdc).toFixed(6)),
      rate: usdcBrlRate,
      avgApy: Number(Number(positionsAgg.avgApyWeighted).toFixed(4)),
    },
    volume7d: {
      depositsBrl: Number(Number(txVol7.depositsBrl).toFixed(2)),
      withdrawsBrl: Number(Number(txVol7.withdrawsBrl).toFixed(2)),
      failures: txVol7.failures,
      pending: txVol7.pending,
    },
    volume30d: {
      depositsBrl: Number(Number(txVol30.depositsBrl).toFixed(2)),
      withdrawsBrl: Number(Number(txVol30.withdrawsBrl).toFixed(2)),
    },
    generatedAt: now.toISOString(),
  });
}
