import { eq, or } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { transactions, transactionEvents, users } from '@/lib/db/schema';
import { fourP } from '@/lib/four-p';
import type { NotificationStatus } from '@/lib/four-p/types';
import { depositToKamino } from '@/lib/kamino/sync';

/**
 * Sync da transação. Aceita o token da 4P (real) ou nosso token interno.
 * Se `txId` for passado, usa pra mapear; senão tenta lookup pelos tokens.
 */
export async function syncTransactionFromToken(token: string, txId?: string) {
  let tx;
  if (txId) {
    [tx] = await db.select().from(transactions).where(eq(transactions.id, txId)).limit(1);
  } else {
    [tx] = await db
      .select()
      .from(transactions)
      .where(
        or(
          eq(transactions.fourPNotificationToken, token),
          eq(transactions.fourPToken, token),
        ),
      )
      .limit(1);
  }
  if (!tx) return { ok: false, reason: 'tx_not_in_db' };

  // Tokens candidatos pra tentar a notificação na 4P (prioridade decrescente)
  const candidates = [
    tx.fourPNotificationToken,
    token !== tx.fourPToken ? token : null,
    tx.fourPTxid,
    tx.fourPToken,
  ].filter((t): t is string => Boolean(t && t.length > 0));

  let notif;
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      notif = await fourP.getNotification(candidate);
      if (notif?.success && notif.info?.data) {
        // Salva o token que funcionou (caso ainda não estivesse salvo)
        if (!tx.fourPNotificationToken) {
          await db
            .update(transactions)
            .set({ fourPNotificationToken: candidate })
            .where(eq(transactions.id, tx.id));
        }
        break;
      }
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('get_notification_error') && !msg.includes('not_found')) {
        throw err;
      }
    }
  }

  if (!notif?.success || !notif.info?.data) {
    if (lastError) console.warn('[reconcile] no candidate worked, last err:', lastError);
    return { ok: false, reason: 'no_notification_yet' };
  }

  const data = notif.info.data;
  const newStatus = data.status as NotificationStatus;

  if (tx.status === newStatus) {
    await db
      .insert(transactionEvents)
      .values({
        transactionId: tx.id,
        eventType: 'webhook_received',
        previousStatus: tx.status,
        newStatus,
        payload: data,
        notificationToken: tx.fourPNotificationToken ?? token,
      })
      .onConflictDoNothing();
    return { ok: true, changed: false };
  }

  await db
    .update(transactions)
    .set({
      status: newStatus,
      confirmedAt: newStatus === 'paid' ? new Date() : tx.confirmedAt,
      solanaSignature: data.custom_data?.transaction_hash ?? tx.solanaSignature,
    })
    .where(eq(transactions.id, tx.id));

  await db
    .insert(transactionEvents)
    .values({
      transactionId: tx.id,
      eventType: 'status_changed',
      previousStatus: tx.status,
      newStatus,
      payload: data,
      notificationToken: tx.fourPNotificationToken ?? token,
    })
    .onConflictDoNothing();

  // auto-deposit no Kamino quando on-ramp fecha
  if (newStatus === 'paid' && tx.kind === 'onramp' && tx.amountUsdc) {
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
      console.error('[reconcile] kamino deposit failed', err);
      await db.insert(transactionEvents).values({
        transactionId: tx.id,
        eventType: 'error',
        payload: {
          step: 'kamino_deposit',
          error: err instanceof Error ? err.message : 'unknown',
        },
      });
    }
  }

  return { ok: true, changed: true, status: newStatus };
}
