import { NextResponse } from 'next/server';
import { gte, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/require-role';
import { db } from '@/lib/db/client';
import { feesCollected } from '@/lib/db/schema';

export async function GET(req: Request) {
  const { ctx, response } = await requireRole(req, ['admin', 'support']);
  if (!ctx) return response;

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400 * 1000);
  const d30 = new Date(now.getTime() - 30 * 86400 * 1000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totals] = await db
    .select({
      totalBrl: sql<string>`coalesce(sum(${feesCollected.amountBrl}), 0)`,
      last7: sql<string>`coalesce(sum(${feesCollected.amountBrl}) filter (where ${feesCollected.createdAt} >= ${d7}), 0)`,
      last30: sql<string>`coalesce(sum(${feesCollected.amountBrl}) filter (where ${feesCollected.createdAt} >= ${d30}), 0)`,
      thisMonth: sql<string>`coalesce(sum(${feesCollected.amountBrl}) filter (where ${feesCollected.createdAt} >= ${thisMonthStart}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(feesCollected);

  const byKind = await db
    .select({
      kind: feesCollected.kind,
      total: sql<string>`coalesce(sum(${feesCollected.amountBrl}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(feesCollected)
    .groupBy(feesCollected.kind);

  const daily = await db
    .select({
      date: sql<string>`date(${feesCollected.createdAt})::text`,
      total: sql<string>`coalesce(sum(${feesCollected.amountBrl}), 0)`,
    })
    .from(feesCollected)
    .where(gte(feesCollected.createdAt, d30))
    .groupBy(sql`date(${feesCollected.createdAt})`)
    .orderBy(sql`date(${feesCollected.createdAt})`);

  return NextResponse.json({
    totals: {
      allTimeBrl: Number(Number(totals.totalBrl).toFixed(2)),
      last7Brl: Number(Number(totals.last7).toFixed(2)),
      last30Brl: Number(Number(totals.last30).toFixed(2)),
      thisMonthBrl: Number(Number(totals.thisMonth).toFixed(2)),
      count: totals.count,
    },
    byKind: byKind.map((k) => ({
      kind: k.kind,
      totalBrl: Number(Number(k.total).toFixed(2)),
      count: k.count,
    })),
    daily: daily.map((d) => ({
      date: d.date,
      totalBrl: Number(Number(d.total).toFixed(2)),
    })),
  });
}
