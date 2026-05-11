/**
 * Seed pra demo dos juízes.
 *
 * Cria/atualiza um user com:
 *   - Onboarding completo (nome, CPF, chave PIX criptografados)
 *   - Role admin (acesso ao painel /admin)
 *   - Posição Kamino mock pré-existente (saldo USDC + APY)
 *   - Transações de histórico (depósitos paid)
 *   - Snapshots diários dos últimos 7 dias (gráfico populado)
 *
 * Uso:
 *   pnpm demo:seed <email> [--privy-user-id <pid>] [--wallet <pubkey>]
 *
 * Importante: o user precisa JÁ EXISTIR no Privy (ou seja, pelo menos uma
 * tentativa de login com aquele email). O script reaproveita o privy_user_id
 * que já estiver no DB; se não existir, exige --privy-user-id e --wallet.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  users,
  transactions,
  transactionEvents,
  kaminoPositions,
  dailyYieldSnapshots,
} from '@/lib/db/schema';
import { encrypt } from '@/lib/crypto/encrypt';
import { normalizeCPF } from '@/lib/validators/cpf';
import { normalizePixKey } from '@/lib/validators/pix';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Uso: pnpm demo:seed <email> [--privy-user-id <pid>] [--wallet <pubkey>]');
    process.exit(1);
  }

  const overridePrivyId = arg('privy-user-id');
  const overrideWallet = arg('wallet');

  // Tenta achar user existente pelo email
  let [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!existing) {
    if (!overridePrivyId || !overrideWallet) {
      console.error(
        `User ${email} não existe no DB. Faça login no app uma vez OU passe --privy-user-id e --wallet.`,
      );
      process.exit(1);
    }
    [existing] = await db
      .insert(users)
      .values({
        email,
        privyUserId: overridePrivyId,
        solanaWalletAddress: overrideWallet,
      })
      .returning();
    console.log(`✓ User criado: ${existing.id}`);
  } else {
    console.log(`✓ User encontrado: ${existing.id} (${existing.email})`);
  }

  // Onboarding completo + role admin
  const cpf = '01702256154';
  const pixKey = email;
  await db
    .update(users)
    .set({
      fullName: 'Juiz Demo',
      cpfEncrypted: encrypt(normalizeCPF(cpf)),
      pixKeyEncrypted: encrypt(normalizePixKey(pixKey)),
      role: 'admin',
      onboardedAt: new Date(),
      disabledAt: null,
    })
    .where(eq(users.id, existing.id));
  console.log(`✓ Onboarded como admin (CPF/PIX criptografados, role=admin)`);

  if (!existing.solanaWalletAddress) {
    console.warn('⚠ User sem solanaWalletAddress — Kamino position não vai funcionar até logar e Privy criar a wallet');
  }

  // Posição Kamino mock pré-existente (R$ 5.000 ≈ 920 USDC com APY 6.25%)
  const principalUsdc = 920;
  const yieldUsdc = 17.45; // ~7 dias de APY 100%/ano simulado
  const currentValue = principalUsdc + yieldUsdc;

  await db
    .insert(kaminoPositions)
    .values({
      userId: existing.id,
      marketPubkey: '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
      obligationPubkey: 'JudgeDemoObligation' + randomUUID().slice(0, 20),
      usdcSupplied: principalUsdc.toFixed(6),
      usdcCurrentValue: currentValue.toFixed(6),
      currentApy: '6.2500',
      lastSyncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: kaminoPositions.userId,
      set: {
        usdcSupplied: principalUsdc.toFixed(6),
        usdcCurrentValue: currentValue.toFixed(6),
        currentApy: '6.2500',
        lastSyncedAt: new Date(),
      },
    });
  console.log(`✓ Kamino position: ${currentValue.toFixed(2)} USDC (principal ${principalUsdc} + yield ${yieldUsdc.toFixed(2)})`);

  // 3 depósitos históricos paid
  const now = Date.now();
  const samples = [
    { daysAgo: 7, amountBrl: 2000, amountUsdc: 368 },
    { daysAgo: 4, amountBrl: 1500, amountUsdc: 276 },
    { daysAgo: 1, amountBrl: 1500, amountUsdc: 276 },
  ];
  for (const s of samples) {
    const txId = randomUUID();
    const createdAt = new Date(now - s.daysAgo * 86400 * 1000);
    await db.insert(transactions).values({
      id: txId,
      userId: existing.id,
      kind: 'onramp',
      status: 'paid',
      amountBrl: s.amountBrl.toFixed(2),
      amountUsdc: s.amountUsdc.toFixed(6),
      fourPTxid: 'demo-' + randomUUID().slice(0, 16),
      fourPToken: randomUUID(),
      receiverWallet: existing.solanaWalletAddress,
      createdAt,
      confirmedAt: new Date(createdAt.getTime() + 60_000),
    });
    await db.insert(transactionEvents).values({
      transactionId: txId,
      eventType: 'created',
      newStatus: 'pending',
      payload: { demo: true },
      createdAt,
    });
    await db.insert(transactionEvents).values({
      transactionId: txId,
      eventType: 'status_changed',
      previousStatus: 'pending',
      newStatus: 'paid',
      payload: { demo: true },
      createdAt: new Date(createdAt.getTime() + 60_000),
    });
  }
  console.log(`✓ 3 transações históricas paid`);

  // Snapshots dos últimos 7 dias (curva crescente)
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now - i * 86400 * 1000);
    const dateStr = date.toISOString().slice(0, 10);
    const dayValue = principalUsdc + ((yieldUsdc * (7 - i)) / 7);
    const brlRate = 5.43;
    await db
      .insert(dailyYieldSnapshots)
      .values({
        userId: existing.id,
        snapshotDate: dateStr,
        usdcSupplied: principalUsdc.toFixed(6),
        usdcCurrentValue: dayValue.toFixed(6),
        apy: '6.2500',
        brlQuote: (dayValue * brlRate).toFixed(2),
        usdcBrlRate: brlRate.toFixed(6),
      })
      .onConflictDoUpdate({
        target: [dailyYieldSnapshots.userId, dailyYieldSnapshots.snapshotDate],
        set: {
          usdcSupplied: principalUsdc.toFixed(6),
          usdcCurrentValue: dayValue.toFixed(6),
          apy: '6.2500',
          brlQuote: (dayValue * brlRate).toFixed(2),
          usdcBrlRate: brlRate.toFixed(6),
        },
      });
  }
  console.log(`✓ 7 snapshots diários (gráfico populado)`);

  console.log(`\n✅ Demo seed completo pra ${email}`);
  console.log(`   role: admin`);
  console.log(`   /app  → dashboard com saldo R$ ${(currentValue * 5.43).toFixed(2)} + gráfico`);
  console.log(`   /admin → painel administrativo completo`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
