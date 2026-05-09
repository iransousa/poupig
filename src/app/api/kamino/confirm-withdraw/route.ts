import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { kaminoPositions, transactionEvents, transactions, users } from '@/lib/db/schema';
import { kamino, getKaminoConfig } from '@/lib/kamino';

const schema = z.object({
  signature: z.string().min(1),
  amountUSDC: z.coerce.number().positive(),
  transactionId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const [user] = await db
    .select({ id: users.id, wallet: users.solanaWalletAddress })
    .from(users)
    .where(eq(users.privyUserId, session.privyUserId))
    .limit(1);
  if (!user?.wallet) return NextResponse.json({ error: 'no_wallet' }, { status: 400 });

  const cfg = getKaminoConfig();

  try {
    if (kamino.confirmWithdraw) {
      await kamino.confirmWithdraw(user.wallet, parsed.data.signature, parsed.data.amountUSDC);
    }

    const pos = await kamino.getPosition(user.wallet);
    await db
      .update(kaminoPositions)
      .set({
        usdcSupplied: (pos?.usdcSupplied ?? 0).toFixed(6),
        usdcCurrentValue: (pos?.usdcCurrentValue ?? 0).toFixed(6),
        lastSyncedAt: new Date(),
      })
      .where(eq(kaminoPositions.userId, user.id));

    if (parsed.data.transactionId) {
      await db
        .update(transactions)
        .set({ solanaSignature: parsed.data.signature })
        .where(eq(transactions.id, parsed.data.transactionId));

      await db.insert(transactionEvents).values({
        transactionId: parsed.data.transactionId,
        eventType: 'kamino_withdraw',
        payload: {
          signature: parsed.data.signature,
          amountUSDC: parsed.data.amountUSDC,
          env: cfg.env,
        },
      });
    }

    return NextResponse.json({ ok: true, position: pos });
  } catch (err) {
    return NextResponse.json(
      { error: 'confirm_failed', message: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }
}
