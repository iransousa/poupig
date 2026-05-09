import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/session';
import { kamino, getKaminoConfig } from '@/lib/kamino';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const schema = z.object({ amountUSDC: z.coerce.number().positive() });

export async function POST(req: Request) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });

  const cfg = getKaminoConfig();
  if (cfg.env === 'mock') {
    return NextResponse.json({ error: 'mock_mode_no_prepare' }, { status: 400 });
  }

  const [user] = await db
    .select({ wallet: users.solanaWalletAddress })
    .from(users)
    .where(eq(users.privyUserId, session.privyUserId))
    .limit(1);
  if (!user?.wallet) return NextResponse.json({ error: 'no_wallet' }, { status: 400 });

  if (!kamino.prepareWithdraw) {
    return NextResponse.json({ error: 'prepare_not_supported' }, { status: 501 });
  }

  try {
    const prepared = await kamino.prepareWithdraw(user.wallet, parsed.data.amountUSDC);
    return NextResponse.json({
      ...prepared,
      env: cfg.env,
      cluster: cfg.cluster,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'prepare_failed', message: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }
}
