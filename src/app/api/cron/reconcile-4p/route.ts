import { NextResponse } from 'next/server';
import { and, eq, isNotNull, lt, or, inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { transactions } from '@/lib/db/schema';
import { syncTransactionFromToken } from '@/lib/four-p/reconcile';
import { env } from '@/env';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (env.CRON_SECRET && auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rows = await db
    .select({ id: transactions.id, token: transactions.fourPToken })
    .from(transactions)
    .where(
      and(
        inArray(transactions.status, ['pending', 'processing']),
        isNotNull(transactions.fourPToken),
        lt(transactions.createdAt, sql`now() - interval '1 minutes'`),
      ),
    )
    .limit(50);

  const results = [];
  for (const r of rows) {
    if (!r.token) continue;
    try {
      const res = await syncTransactionFromToken(r.token);
      results.push({ id: r.id, ...res });
    } catch (err) {
      results.push({ id: r.id, ok: false, error: err instanceof Error ? err.message : 'unknown' });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
