import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { fourP } from '@/lib/four-p';
import { kamino } from '@/lib/kamino';
import { syncPosition } from '@/lib/kamino/sync';

export async function GET(req: Request) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const [user] = await db
    .select({ id: users.id, wallet: users.solanaWalletAddress })
    .from(users)
    .where(eq(users.privyUserId, session.privyUserId))
    .limit(1);
  if (!user?.wallet) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

  const pos = (await syncPosition(user.id, user.wallet)) ?? (await kamino.getPosition(user.wallet));

  const usdc = pos?.usdcCurrentValue ?? 0;
  const apy = pos?.apy ?? (await kamino.getCurrentApy());

  let brl = 0;
  let rate = 0;
  if (usdc > 0) {
    try {
      const q = await fourP.priceConversion({
        amount: usdc.toString(),
        from: 'USDC',
        to: 'BRL',
      });
      brl = Number(q.info.data.amount);
      rate = Number(q.info.data.quote.price);
    } catch {
      brl = 0;
    }
  }

  return NextResponse.json({
    usdc: Number(usdc.toFixed(6)),
    usdcSupplied: Number((pos?.usdcSupplied ?? 0).toFixed(6)),
    brl: Number(brl.toFixed(2)),
    usdcBrlRate: rate,
    apy: Number(apy.toFixed(4)),
    hasPosition: Boolean(pos && usdc > 0),
  });
}
