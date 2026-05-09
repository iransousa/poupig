import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/require-role';
import { db } from '@/lib/db/client';
import {
  users,
  kaminoPositions,
  transactions,
  transactionEvents,
} from '@/lib/db/schema';
import { decrypt } from '@/lib/crypto/encrypt';

function maskCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return '***';
  return `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { ctx, response } = await requireRole(req, ['admin', 'support']);
  if (!ctx) return response;

  const [user] = await db.select().from(users).where(eq(users.id, params.id)).limit(1);
  if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [position] = await db
    .select()
    .from(kaminoPositions)
    .where(eq(kaminoPositions.userId, user.id))
    .limit(1);

  const txs = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, user.id))
    .orderBy(desc(transactions.createdAt))
    .limit(30);

  const events = await db
    .select()
    .from(transactionEvents)
    .where(eq(transactionEvents.transactionId, txs[0]?.id ?? '00000000-0000-0000-0000-000000000000'))
    .orderBy(desc(transactionEvents.createdAt))
    .limit(20);

  let cpfMasked: string | null = null;
  try {
    if (user.cpfEncrypted) cpfMasked = maskCpf(decrypt(user.cpfEncrypted));
  } catch {
    cpfMasked = null;
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
      cpfMasked,
      solanaWalletAddress: user.solanaWalletAddress,
      onboardedAt: user.onboardedAt,
      disabledAt: user.disabledAt,
      createdAt: user.createdAt,
    },
    position: position
      ? {
          marketPubkey: position.marketPubkey,
          obligationPubkey: position.obligationPubkey,
          usdcSupplied: Number(position.usdcSupplied),
          usdcCurrentValue: Number(position.usdcCurrentValue),
          currentApy: position.currentApy ? Number(position.currentApy) : null,
          lastSyncedAt: position.lastSyncedAt,
        }
      : null,
    transactions: txs.map((t) => ({
      id: t.id,
      kind: t.kind,
      status: t.status,
      amountBrl: t.amountBrl ? Number(t.amountBrl) : null,
      amountUsdc: t.amountUsdc ? Number(t.amountUsdc) : null,
      fourPTxid: t.fourPTxid,
      fourPNotificationToken: t.fourPNotificationToken,
      pixCopiaECola: t.pixCopiaECola,
      pixQrChave: t.pixQrChave,
      receiverWallet: t.receiverWallet,
      destinationPixKey: t.destinationPixKey,
      solanaSignature: t.solanaSignature,
      errorMessage: t.errorMessage,
      createdAt: t.createdAt,
      confirmedAt: t.confirmedAt,
    })),
    recentEvents: events,
  });
}
