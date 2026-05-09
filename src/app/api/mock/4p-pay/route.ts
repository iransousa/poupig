import { NextResponse } from 'next/server';
import { env } from '@/env';
import { requireSession } from '@/lib/auth/session';
import { mockMarkPaid } from '@/lib/four-p/mock-client';
import { syncTransactionFromToken } from '@/lib/four-p/reconcile';
import { db } from '@/lib/db/client';
import { transactions, users } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function POST(req: Request) {
  if (env.FOUR_P_DRIVER !== 'mock') {
    return NextResponse.json({ error: 'mock_disabled' }, { status: 404 });
  }
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const { transactionId } = (await req.json().catch(() => ({}))) as { transactionId?: string };
  if (!transactionId) return NextResponse.json({ error: 'transactionId_required' }, { status: 400 });

  const [tx] = await db
    .select({ id: transactions.id, token: transactions.fourPToken })
    .from(transactions)
    .innerJoin(users, eq(users.id, transactions.userId))
    .where(and(eq(transactions.id, transactionId), eq(users.privyUserId, session.privyUserId)))
    .limit(1);

  if (!tx || !tx.token) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const rec = mockMarkPaid(tx.token);
  if (!rec) return NextResponse.json({ error: 'mock_record_missing' }, { status: 404 });

  const synced = await syncTransactionFromToken(tx.token);
  return NextResponse.json({ ok: true, synced });
}
