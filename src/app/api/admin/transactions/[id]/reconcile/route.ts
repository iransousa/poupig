import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireRole, logAdminAction } from '@/lib/auth/require-role';
import { db } from '@/lib/db/client';
import { transactions } from '@/lib/db/schema';
import { syncTransactionFromToken } from '@/lib/four-p/reconcile';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { ctx, response } = await requireRole(req, ['admin', 'support']);
  if (!ctx) return response;

  const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id)).limit(1);
  if (!tx) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Aceita token via body pro admin tentar manualmente com um token específico
  const body = (await req.json().catch(() => ({}))) as {
    forceToken?: string;
    forcePaid?: boolean;
  };

  // Force-paid: admin override quando 4P não responde mas user já pagou
  if (body.forcePaid) {
    const { transactionEvents, users } = await import('@/lib/db/schema');
    const { depositToKamino } = await import('@/lib/kamino/sync');

    await db
      .update(transactions)
      .set({ status: 'paid', confirmedAt: new Date() })
      .where(eq(transactions.id, tx.id));

    await db.insert(transactionEvents).values({
      transactionId: tx.id,
      eventType: 'admin_force_paid',
      previousStatus: tx.status,
      newStatus: 'paid',
      payload: { actor: ctx.userId, reason: 'manual_override' },
    });

    if (tx.kind === 'onramp' && tx.amountUsdc) {
      try {
        const [user] = await db
          .select({ id: users.id, wallet: users.solanaWalletAddress })
          .from(users)
          .where(eq(users.id, tx.userId))
          .limit(1);
        if (user?.wallet) {
          await depositToKamino({
            userId: user.id,
            wallet: user.wallet,
            amountUSDC: Number(tx.amountUsdc),
            transactionId: tx.id,
          });
        }
      } catch (err) {
        console.error('[admin force_paid] kamino deposit failed', err);
      }
    }

    await logAdminAction({
      actorId: ctx.userId,
      targetUserId: tx.userId,
      action: 'force_paid',
      payload: { transactionId: tx.id, previousStatus: tx.status },
    });

    return NextResponse.json({ ok: true, action: 'force_paid' });
  }

  const tokenToUse =
    body.forceToken ?? tx.fourPNotificationToken ?? tx.fourPTxid ?? tx.fourPToken;
  if (!tokenToUse) {
    return NextResponse.json({ error: 'no_token_available' }, { status: 400 });
  }

  const result = await syncTransactionFromToken(tokenToUse, tx.id);
  await logAdminAction({
    actorId: ctx.userId,
    targetUserId: tx.userId,
    action: 'reconcile_transaction',
    payload: { transactionId: tx.id, tokenUsed: tokenToUse, result },
  });

  return NextResponse.json({ ok: true, result, tokenUsed: tokenToUse });
}
