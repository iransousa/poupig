import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/require-role';
import { db } from '@/lib/db/client';
import { transactions, transactionEvents } from '@/lib/db/schema';
import { decodePixBrCode } from '@/lib/pix/decode';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { ctx, response } = await requireRole(req, ['admin', 'support']);
  if (!ctx) return response;

  const [tx] = await db.select().from(transactions).where(eq(transactions.id, params.id)).limit(1);
  if (!tx) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const events = await db
    .select()
    .from(transactionEvents)
    .where(eq(transactionEvents.transactionId, tx.id))
    .limit(50);

  const pixDecoded = tx.pixCopiaECola ? decodePixBrCode(tx.pixCopiaECola) : null;

  return NextResponse.json({
    transaction: {
      id: tx.id,
      kind: tx.kind,
      status: tx.status,
      fourPTxid: tx.fourPTxid,
      fourPToken: tx.fourPToken,
      fourPNotificationToken: tx.fourPNotificationToken,
      amountBrl: tx.amountBrl,
      amountUsdc: tx.amountUsdc,
      pixCopiaECola: tx.pixCopiaECola,
      pixQrChave: tx.pixQrChave,
      receiverWallet: tx.receiverWallet,
      destinationPixKey: tx.destinationPixKey,
      createdAt: tx.createdAt,
      expiresAt: tx.expiresAt,
      confirmedAt: tx.confirmedAt,
    },
    pixDecoded,
    events,
  });
}
