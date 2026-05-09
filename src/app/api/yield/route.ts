import { NextResponse } from 'next/server';
import { desc, eq, and, gte } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { dailyYieldSnapshots, users, kaminoPositions } from '@/lib/db/schema';
import { fourP } from '@/lib/four-p';
import { kamino } from '@/lib/kamino';

export async function GET(req: Request) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const [user] = await db
    .select({ id: users.id, wallet: users.solanaWalletAddress })
    .from(users)
    .where(eq(users.privyUserId, session.privyUserId))
    .limit(1);
  if (!user?.wallet) return NextResponse.json({ error: 'no_wallet' }, { status: 400 });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const snapshots = await db
    .select()
    .from(dailyYieldSnapshots)
    .where(
      and(
        eq(dailyYieldSnapshots.userId, user.id),
        gte(dailyYieldSnapshots.snapshotDate, thirtyDaysAgoStr),
      ),
    )
    .orderBy(desc(dailyYieldSnapshots.snapshotDate))
    .limit(31);

  // Posição atual em tempo real (mais recente que snapshot)
  const pos = await kamino.getPosition(user.wallet);
  const quote = pos && pos.usdcCurrentValue > 0
    ? await fourP.priceConversion({
        amount: pos.usdcCurrentValue.toString(),
        from: 'USDC',
        to: 'BRL',
      })
    : null;
  const currentBrl = quote ? Number(quote.info.data.amount) : 0;
  const currentUsdc = pos?.usdcCurrentValue ?? 0;

  const [position] = await db
    .select()
    .from(kaminoPositions)
    .where(eq(kaminoPositions.userId, user.id))
    .limit(1);
  const principalUsdc = Number(position?.usdcSupplied ?? 0);

  // Série pro gráfico: snapshots do mais antigo pro mais novo + ponto "agora"
  const series = snapshots
    .slice()
    .reverse()
    .map((s) => ({
      date: s.snapshotDate,
      brl: Number(s.brlQuote),
      usdc: Number(s.usdcCurrentValue),
    }));
  series.push({
    date: new Date().toISOString().slice(0, 10),
    brl: currentBrl,
    usdc: currentUsdc,
  });

  // Rendimentos
  const todayStr = new Date().toISOString().slice(0, 10);
  const ystrStr = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 10);
  const firstOfMonth = `${todayStr.slice(0, 7)}-01`;

  const byDate = new Map(series.map((s) => [s.date, s]));
  const yesterday = byDate.get(ystrStr);
  const monthStart = snapshots.find((s) => s.snapshotDate <= firstOfMonth);

  const yieldTodayBRL = yesterday ? currentBrl - yesterday.brl : 0;
  const yieldTodayUSDC = yesterday ? currentUsdc - yesterday.usdc : 0;

  const yieldMonthBRL = monthStart ? currentBrl - Number(monthStart.brlQuote) : 0;
  const yieldMonthUSDC = monthStart ? currentUsdc - Number(monthStart.usdcCurrentValue) : 0;

  const yieldTotalUSDC = Math.max(currentUsdc - principalUsdc, 0);

  return NextResponse.json({
    currentBrl: Number(currentBrl.toFixed(2)),
    currentUsdc: Number(currentUsdc.toFixed(6)),
    principalUsdc: Number(principalUsdc.toFixed(6)),
    apy: pos?.apy ?? 0,
    yieldTodayBRL: Number(yieldTodayBRL.toFixed(2)),
    yieldTodayUSDC: Number(yieldTodayUSDC.toFixed(6)),
    yieldMonthBRL: Number(yieldMonthBRL.toFixed(2)),
    yieldMonthUSDC: Number(yieldMonthUSDC.toFixed(6)),
    yieldTotalUSDC: Number(yieldTotalUSDC.toFixed(6)),
    series,
  });
}
