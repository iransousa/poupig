import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { getKaminoConfig } from '@/lib/kamino';
import { getPreflight } from '@/lib/kamino/real-driver';

export async function GET(req: Request) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const cfg = getKaminoConfig();
  if (cfg.env === 'mock') {
    return NextResponse.json({
      env: 'mock',
      solLamports: 1e9,
      usdcAmount: 999,
      hasSol: true,
      hasUsdc: true,
      minSolRecommended: 0,
    });
  }

  const [user] = await db
    .select({ wallet: users.solanaWalletAddress })
    .from(users)
    .where(eq(users.privyUserId, session.privyUserId))
    .limit(1);
  if (!user?.wallet) return NextResponse.json({ error: 'no_wallet' }, { status: 400 });

  try {
    const url = new URL(req.url);
    const mint = url.searchParams.get('mint') ?? undefined;
    const pre = await getPreflight(user.wallet, mint);
    return NextResponse.json({ env: cfg.env, cluster: cfg.cluster, ...pre });
  } catch (err) {
    return NextResponse.json(
      { error: 'preflight_failed', message: err instanceof Error ? err.message : 'unknown' },
      { status: 502 },
    );
  }
}
