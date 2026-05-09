import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { transactions, users } from '@/lib/db/schema';

export async function GET(req: Request) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.privyUserId, session.privyUserId))
    .limit(1);
  if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const rows = await db
    .select({
      id: transactions.id,
      kind: transactions.kind,
      status: transactions.status,
      amountBrl: transactions.amountBrl,
      amountUsdc: transactions.amountUsdc,
      createdAt: transactions.createdAt,
      confirmedAt: transactions.confirmedAt,
    })
    .from(transactions)
    .where(eq(transactions.userId, user.id))
    .orderBy(desc(transactions.createdAt))
    .limit(50);

  return NextResponse.json({ items: rows });
}
