import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { transactions, transactionEvents } from '@/lib/db/schema';
import { fourP } from '@/lib/four-p';
import { getLastCall } from '@/lib/four-p/real-client';
import { loadDecryptedUserByPrivyId } from '@/lib/crypto/decrypt-user';
import { env } from '@/env';
import { computeOnrampFees, loadFeeConfig, recordFees, validateLimits } from '@/lib/fees/calc';

const schema = z.object({
  amountBRL: z.coerce.number().positive().max(1_000_000),
});

export async function POST(req: Request) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });

  const user = await loadDecryptedUserByPrivyId(session.privyUserId);
  if (!user || !user.solanaWalletAddress || !user.cpf) {
    return NextResponse.json({ error: 'user_not_onboarded' }, { status: 400 });
  }

  const feeCfg = await loadFeeConfig();
  const limitCheck = await validateLimits({
    userId: user.id,
    kind: 'onramp',
    amountBrl: parsed.data.amountBRL,
    cfg: feeCfg,
  });
  if (!limitCheck.ok) {
    return NextResponse.json(
      { error: limitCheck.error, message: limitCheck.message },
      { status: 400 },
    );
  }
  const fees = computeOnrampFees(parsed.data.amountBRL, feeCfg);
  const amountToConvertBRL = fees.netBrl;

  const customId = randomUUID();
  const token = randomUUID();
  const notificationUrl = `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/4p?token=${token}`;

  const quote = await fourP.priceConversion({
    amount: amountToConvertBRL.toString(),
    from: 'BRL',
    to: 'USDC',
  });
  const amountUSDC = Number(quote.info.data.amount);

  const [tx] = await db
    .insert(transactions)
    .values({
      id: customId,
      userId: user.id,
      kind: 'onramp',
      status: 'pending',
      amountBrl: parsed.data.amountBRL.toFixed(2),
      amountUsdc: amountUSDC.toFixed(6),
      fourPToken: token,
      receiverWallet: user.solanaWalletAddress,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    })
    .returning();

  try {
    const created = await fourP.createPixOnRamp({
      cpf: user.cpf,
      email: user.email ?? 'no-email@poupapp.local',
      amountBRL: parsed.data.amountBRL,
      customId,
      receiverWallet: user.solanaWalletAddress,
      notificationUrl,
    });

    await db
      .update(transactions)
      .set({
        fourPTxid: created.info.data.txid,
        pixCopiaECola: created.info.data.pixCopiaECola,
        pixQrChave: created.info.data.chave,
      })
      .where(eq(transactions.id, tx.id));

    // Audit completo: request + response brutos da 4P
    const lastCall = getLastCall(`onramp-${customId}`);
    await db.insert(transactionEvents).values({
      transactionId: tx.id,
      eventType: 'created',
      newStatus: 'pending',
      payload: {
        notificationUrl,
        notificationToken: token,
        fourPRequest: lastCall?.reqBody,
        fourPResponse: lastCall?.resBody,
        fourPResponseStatus: lastCall?.status,
        fees,
      },
    });

    if (fees.feeBrl > 0) {
      await recordFees({
        transactionId: tx.id,
        userId: user.id,
        breakdown: fees.breakdown,
      });
    }

    return NextResponse.json({
      id: tx.id,
      status: 'pending',
      amountBRL: parsed.data.amountBRL,
      amountUSDC,
      feeBrl: fees.feeBrl,
      netBrl: fees.netBrl,
      pixCopiaECola: created.info.data.pixCopiaECola,
      pixChave: created.info.data.chave,
      expiresAt: tx.expiresAt,
    });
  } catch (err) {
    const lastCall = getLastCall(`onramp-${customId}`);
    await db
      .update(transactions)
      .set({ status: 'error', errorMessage: err instanceof Error ? err.message : 'unknown' })
      .where(and(eq(transactions.id, tx.id), eq(transactions.status, 'pending')));
    await db.insert(transactionEvents).values({
      transactionId: tx.id,
      eventType: 'error',
      payload: {
        step: 'create_pix',
        notificationUrl,
        error: err instanceof Error ? err.message : 'unknown',
        fourPRequest: lastCall?.reqBody,
        fourPResponse: lastCall?.resBody,
        fourPResponseStatus: lastCall?.status,
      },
    });
    return NextResponse.json({ error: 'four_p_failed' }, { status: 502 });
  }
}
