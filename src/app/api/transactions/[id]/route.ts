import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { transactions, users } from '@/lib/db/schema';

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const [row] = await db
    .select({
      id: transactions.id,
      kind: transactions.kind,
      status: transactions.status,
      amountBrl: transactions.amountBrl,
      amountUsdc: transactions.amountUsdc,
      pixCopiaECola: transactions.pixCopiaECola,
      pixQrChave: transactions.pixQrChave,
      receiverWallet: transactions.receiverWallet,
      solanaSignature: transactions.solanaSignature,
      errorMessage: transactions.errorMessage,
      createdAt: transactions.createdAt,
      expiresAt: transactions.expiresAt,
      confirmedAt: transactions.confirmedAt,
    })
    .from(transactions)
    .innerJoin(users, eq(users.id, transactions.userId))
    .where(and(eq(transactions.id, params.id), eq(users.privyUserId, session.privyUserId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(row);
}
