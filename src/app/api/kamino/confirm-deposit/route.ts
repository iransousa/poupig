import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { kaminoPositions, transactionEvents, transactions, users } from '@/lib/db/schema';
import { kamino, getKaminoConfig } from '@/lib/kamino';
import { env } from '@/env';

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
    if (kamino.confirmDeposit) {
      await kamino.confirmDeposit(user.wallet, parsed.data.signature, parsed.data.amountUSDC);
    }

    const pos = await kamino.getPosition(user.wallet);
    const apy = pos?.apy ?? (await kamino.getCurrentApy());

    await db
      .insert(kaminoPositions)
      .values({
        userId: user.id,
        marketPubkey: env.KAMINO_MARKET_PUBKEY ?? cfg.mainMarket,
        obligationPubkey: pos?.obligationPubkey ?? null,
        usdcSupplied: (pos?.usdcSupplied ?? parsed.data.amountUSDC).toFixed(6),
        usdcCurrentValue: (pos?.usdcCurrentValue ?? parsed.data.amountUSDC).toFixed(6),
        currentApy: apy.toFixed(4),
        lastSyncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: kaminoPositions.userId,
        set: {
          obligationPubkey: pos?.obligationPubkey ?? null,
          usdcSupplied: (pos?.usdcSupplied ?? parsed.data.amountUSDC).toFixed(6),
          usdcCurrentValue: (pos?.usdcCurrentValue ?? parsed.data.amountUSDC).toFixed(6),
          currentApy: apy.toFixed(4),
          lastSyncedAt: new Date(),
        },
      });

    if (parsed.data.transactionId) {
      await db
        .update(transactions)
        .set({ solanaSignature: parsed.data.signature })
        .where(eq(transactions.id, parsed.data.transactionId));

      await db.insert(transactionEvents).values({
        transactionId: parsed.data.transactionId,
        eventType: 'kamino_deposit',
        payload: {
          signature: parsed.data.signature,
          amountUSDC: parsed.data.amountUSDC,
          apy,
          env: cfg.env,
        },
      });
    }

    return NextResponse.json({ ok: true, apy, position: pos });
  } catch (err) {
    return NextResponse.json(
      { error: 'confirm_failed', message: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }
}
