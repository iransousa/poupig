import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { transactions, transactionEvents, kaminoPositions } from '@/lib/db/schema';
import { fourP } from '@/lib/four-p';
import { getLastCall } from '@/lib/four-p/real-client';
import { loadDecryptedUserByPrivyId } from '@/lib/crypto/decrypt-user';
import { withdrawFromKamino } from '@/lib/kamino/sync';
import { env } from '@/env';
import { computeOfframpFees, loadFeeConfig, recordFees } from '@/lib/fees/calc';

const schema = z.object({
  amountBRL: z.coerce.number().min(1).max(50000),
});

export async function POST(req: Request) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });

  const user = await loadDecryptedUserByPrivyId(session.privyUserId);
  if (!user || !user.solanaWalletAddress || !user.cpf || !user.pixKey) {
    return NextResponse.json({ error: 'user_not_onboarded' }, { status: 400 });
  }

  const feeCfg = await loadFeeConfig();
  if (parsed.data.amountBRL < feeCfg.minWithdrawBrl) {
    return NextResponse.json(
      {
        error: 'below_minimum',
        message: `Valor mínimo de saque: R$ ${feeCfg.minWithdrawBrl.toFixed(2)}`,
      },
      { status: 400 },
    );
  }
  const fees = computeOfframpFees(parsed.data.amountBRL, feeCfg);

  // cotação BRL → USDC (usa valor bruto; fee será debitado no PIX final)
  const quote = await fourP.priceConversion({
    amount: parsed.data.amountBRL.toString(),
    from: 'BRL',
    to: 'USDC',
  });
  const amountUSDC = Number(quote.info.data.amount);

  // validar saldo
  const [position] = await db
    .select()
    .from(kaminoPositions)
    .where(eq(kaminoPositions.userId, user.id))
    .limit(1);
  if (!position || Number(position.usdcCurrentValue) < amountUSDC) {
    return NextResponse.json({ error: 'insufficient_balance' }, { status: 400 });
  }

  const customId = randomUUID();
  const token = randomUUID();
  const notificationUrl = `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/4p?token=${token}`;

  const [tx] = await db
    .insert(transactions)
    .values({
      id: customId,
      userId: user.id,
      kind: 'offramp',
      status: 'pending',
      amountBrl: parsed.data.amountBRL.toFixed(2),
      amountUsdc: amountUSDC.toFixed(6),
      fourPToken: token,
      destinationPixKey: user.pixKey,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    })
    .returning();

  try {
    // 1. withdraw do Kamino (mock ou real skeleton)
    await withdrawFromKamino({
      userId: user.id,
      wallet: user.solanaWalletAddress,
      amountUSDC,
      transactionId: tx.id,
    });

    // 2. cria off-ramp na 4P
    const offramp = await fourP.createPixOffRamp({
      cpf: user.cpf,
      email: user.email ?? 'no-email@poupapp.local',
      amountUSDC,
      customId,
      senderWallet: user.solanaWalletAddress,
      destinationPixKey: user.pixKey,
      notificationUrl,
    });

    await db
      .update(transactions)
      .set({
        fourPTxid: offramp.info.data.txid,
        receiverWallet: offramp.info.data.receiver_wallet,
        status: 'processing',
      })
      .where(eq(transactions.id, tx.id));

    const lastCall = getLastCall(`offramp-${customId}`);
    await db.insert(transactionEvents).values({
      transactionId: tx.id,
      eventType: 'created',
      newStatus: 'processing',
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
      await recordFees({ transactionId: tx.id, userId: user.id, breakdown: fees.breakdown });
    }

    return NextResponse.json({
      id: tx.id,
      status: 'processing',
      amountBRL: parsed.data.amountBRL,
      netBrl: fees.netBrl,
      feeBrl: fees.feeBrl,
      amountUSDC,
      receiverWallet: offramp.info.data.receiver_wallet,
      pixKey: user.pixKey,
    });
  } catch (err) {
    await db
      .update(transactions)
      .set({
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'unknown',
      })
      .where(and(eq(transactions.id, tx.id), eq(transactions.status, 'pending')));
    return NextResponse.json(
      { error: 'withdraw_failed', message: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }
}
