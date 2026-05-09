import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { kaminoPositions, transactionEvents } from '@/lib/db/schema';
import { kamino } from './index';
import { getKaminoConfig } from './config';
import { env } from '@/env';
import {
  defaultFallbackTarget,
  loadActiveAllocation,
  splitAmount,
  type ActiveTarget,
} from '@/lib/allocation/active';

/**
 * Executa deposit no Kamino.
 * - Mock: faz tudo server-side e retorna signature fake.
 * - Real (staging/devnet/mainnet): precisa assinatura client-side (Privy).
 *   Esta função só grava a posição após o client confirmar a signature via /api/kamino/confirm-deposit.
 */
export async function depositToKamino(opts: {
  userId: string;
  wallet: string;
  amountUSDC: number;
  transactionId?: string;
}) {
  const cfg = getKaminoConfig();
  if (cfg.env !== 'mock') {
    // Em modo real, o deposit acontece via cliente. Apenas marca evento pendente.
    if (opts.transactionId) {
      await db.insert(transactionEvents).values({
        transactionId: opts.transactionId,
        eventType: 'kamino_deposit_pending',
        payload: {
          env: cfg.env,
          amountUSDC: opts.amountUSDC,
          message: 'Aguardando assinatura client-side via Privy',
        },
      });
    }
    return { signature: null, apy: null, pending: true };
  }

  // Resolve a estratégia ativa e divide o valor entre targets.
  const allocation = await loadActiveAllocation();
  const targets: ActiveTarget[] = allocation?.targets ?? [defaultFallbackTarget()];
  const splits = splitAmount(opts.amountUSDC, targets);

  const deposits: Array<{ target: ActiveTarget; amountUSDC: number; signature: string }> = [];
  for (const { target, amountUSDC } of splits) {
    if (amountUSDC <= 0) continue;
    const { signature } = await kamino.deposit(opts.wallet, amountUSDC, {
      targetPubkey: target.targetPubkey,
      targetMint: target.mintPubkey,
      targetLabel: target.label,
    });
    deposits.push({ target, amountUSDC, signature });
  }

  const pos = await kamino.getPosition(opts.wallet);
  const apy = pos?.apy ?? (await kamino.getCurrentApy());

  await db
    .insert(kaminoPositions)
    .values({
      userId: opts.userId,
      marketPubkey: env.KAMINO_MARKET_PUBKEY ?? cfg.mainMarket,
      obligationPubkey: pos?.obligationPubkey ?? null,
      usdcSupplied: (pos?.usdcSupplied ?? opts.amountUSDC).toFixed(6),
      usdcCurrentValue: (pos?.usdcCurrentValue ?? opts.amountUSDC).toFixed(6),
      currentApy: apy.toFixed(4),
      lastSyncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: kaminoPositions.userId,
      set: {
        obligationPubkey: pos?.obligationPubkey ?? null,
        usdcSupplied: sql`${kaminoPositions.usdcSupplied} + ${opts.amountUSDC.toFixed(6)}`,
        usdcCurrentValue: (pos?.usdcCurrentValue ?? opts.amountUSDC).toFixed(6),
        currentApy: apy.toFixed(4),
        lastSyncedAt: new Date(),
      },
    });

  if (opts.transactionId) {
    await db.insert(transactionEvents).values({
      transactionId: opts.transactionId,
      eventType: 'kamino_deposit',
      payload: {
        env: cfg.env,
        strategy: allocation
          ? { id: allocation.strategyId, name: allocation.strategyName }
          : { id: null, name: 'default-fallback' },
        totalUSDC: opts.amountUSDC,
        apy,
        splits: deposits.map((d) => ({
          targetLabel: d.target.label,
          targetPubkey: d.target.targetPubkey,
          weightBps: d.target.weightBps,
          amountUSDC: d.amountUSDC,
          signature: d.signature,
        })),
      },
    });
  }

  const primarySignature = deposits[0]?.signature ?? null;
  return { signature: primarySignature, apy, pending: false, splits: deposits.length };
}

export async function withdrawFromKamino(opts: {
  userId: string;
  wallet: string;
  amountUSDC: number;
  transactionId?: string;
}) {
  const cfg = getKaminoConfig();
  if (cfg.env !== 'mock') {
    if (opts.transactionId) {
      await db.insert(transactionEvents).values({
        transactionId: opts.transactionId,
        eventType: 'kamino_withdraw_pending',
        payload: { env: cfg.env, amountUSDC: opts.amountUSDC },
      });
    }
    return { signature: null, pending: true };
  }

  const { signature } = await kamino.withdraw(opts.wallet, opts.amountUSDC);
  const pos = await kamino.getPosition(opts.wallet);

  await db
    .update(kaminoPositions)
    .set({
      usdcSupplied: (pos?.usdcSupplied ?? 0).toFixed(6),
      usdcCurrentValue: (pos?.usdcCurrentValue ?? 0).toFixed(6),
      lastSyncedAt: new Date(),
    })
    .where(eq(kaminoPositions.userId, opts.userId));

  if (opts.transactionId) {
    await db.insert(transactionEvents).values({
      transactionId: opts.transactionId,
      eventType: 'kamino_withdraw',
      payload: { signature, amountUSDC: opts.amountUSDC, env: cfg.env },
    });
  }

  return { signature, pending: false };
}

export async function syncPosition(userId: string, wallet: string) {
  const pos = await kamino.getPosition(wallet);
  if (!pos) return null;
  await db
    .update(kaminoPositions)
    .set({
      usdcSupplied: pos.usdcSupplied.toFixed(6),
      usdcCurrentValue: pos.usdcCurrentValue.toFixed(6),
      currentApy: pos.apy.toFixed(4),
      lastSyncedAt: new Date(),
    })
    .where(eq(kaminoPositions.userId, userId));
  return pos;
}
