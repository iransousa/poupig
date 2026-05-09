import { NextResponse } from 'next/server';
import { gte, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/require-role';
import { db } from '@/lib/db/client';
import { dailyYieldSnapshots } from '@/lib/db/schema';

export async function GET(req: Request) {
  const { ctx, response } = await requireRole(req, ['admin', 'support']);
  if (!ctx) return response;

  const url = new URL(req.url);
  const days = Math.min(Number(url.searchParams.get('days') ?? '30'), 180);
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = from.toISOString().slice(0, 10);

  const rows = await db
    .select({
      date: dailyYieldSnapshots.snapshotDate,
      tvlUsdc: sql<string>`sum(${dailyYieldSnapshots.usdcCurrentValue})`,
      tvlBrl: sql<string>`sum(${dailyYieldSnapshots.brlQuote})`,
      users: sql<number>`count(*)::int`,
    })
    .from(dailyYieldSnapshots)
    .where(gte(dailyYieldSnapshots.snapshotDate, fromStr))
    .groupBy(dailyYieldSnapshots.snapshotDate)
    .orderBy(dailyYieldSnapshots.snapshotDate);

  return NextResponse.json({
    series: rows.map((r) => ({
      date: r.date,
      tvlUsdc: Number(r.tvlUsdc),
      tvlBrl: Number(r.tvlBrl),
      users: r.users,
    })),
  });
}
