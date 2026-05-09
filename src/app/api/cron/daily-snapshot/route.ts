import { NextResponse } from 'next/server';
import { and, desc, eq, isNotNull, lt } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { dailyYieldSnapshots, feesCollected, users } from '@/lib/db/schema';
import { kamino } from '@/lib/kamino';
import { fourP } from '@/lib/four-p';
import { env } from '@/env';
import { loadFeeConfig } from '@/lib/fees/calc';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (env.CRON_SECRET && auth !== `Bearer ${env.CRON_SECRET}`) {
    const url = new URL(req.url);
    if (url.searchParams.get('secret') !== env.CRON_SECRET) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const feeCfg = await loadFeeConfig();
  const perfBps = feeCfg.performancePercentBps;

  const rows = await db
    .select({ id: users.id, wallet: users.solanaWalletAddress })
    .from(users)
    .where(isNotNull(users.solanaWalletAddress));

  const today = new Date();
  today.setUTCHours(3, 0, 0, 0); // 00:00 BRT = 03:00 UTC
  const snapshotDate = today.toISOString().slice(0, 10);

  const results = [];
  for (const u of rows) {
    if (!u.wallet) continue;
    try {
      const pos = await kamino.getPosition(u.wallet);
      if (!pos || pos.usdcCurrentValue <= 0) {
        results.push({ userId: u.id, skipped: true });
        continue;
      }

      // Performance fee: calcula sobre o yield desde o último snapshot
      let perfFeeUsdc = 0;
      let perfFeeBrl = 0;
      if (perfBps > 0) {
        const [prev] = await db
          .select()
          .from(dailyYieldSnapshots)
          .where(
            and(
              eq(dailyYieldSnapshots.userId, u.id),
              lt(dailyYieldSnapshots.snapshotDate, snapshotDate),
            ),
          )
          .orderBy(desc(dailyYieldSnapshots.snapshotDate))
          .limit(1);

        const prevValue = prev ? Number(prev.usdcCurrentValue) : pos.usdcSupplied;
        const yieldSince = Math.max(0, pos.usdcCurrentValue - prevValue);
        perfFeeUsdc = Number(((yieldSince * perfBps) / 10_000).toFixed(6));
      }

      const quote = await fourP.priceConversion({
        amount: pos.usdcCurrentValue.toString(),
        from: 'USDC',
        to: 'BRL',
      });
      const brl = Number(quote.info.data.amount);
      const rate = Number(quote.info.data.quote.price);

      if (perfFeeUsdc > 0) {
        perfFeeBrl = Number((perfFeeUsdc * rate).toFixed(2));

        await db.insert(feesCollected).values({
          userId: u.id,
          kind: 'performance',
          amountUsdc: perfFeeUsdc.toFixed(6),
          amountBrl: perfFeeBrl.toFixed(2),
        });

        // Debita do saldo on-chain (mock) para a receita realmente existir
        if (kamino.adjustPosition) {
          try {
            await kamino.adjustPosition(u.wallet, -perfFeeUsdc, 'performance_fee');
          } catch (err) {
            console.warn('[daily-snapshot] adjustPosition skipped', err);
          }
        }
      }

      // Relê posição pós-debit pra snapshot refletir o valor líquido
      const posAfter = perfFeeUsdc > 0 ? (await kamino.getPosition(u.wallet)) ?? pos : pos;
      const finalValue = posAfter.usdcCurrentValue;
      const finalBrl =
        perfFeeUsdc > 0
          ? Number((finalValue * rate).toFixed(2))
          : brl;

      await db
        .insert(dailyYieldSnapshots)
        .values({
          userId: u.id,
          snapshotDate,
          usdcSupplied: posAfter.usdcSupplied.toFixed(6),
          usdcCurrentValue: finalValue.toFixed(6),
          apy: posAfter.apy.toFixed(4),
          brlQuote: finalBrl.toFixed(2),
          usdcBrlRate: rate.toFixed(6),
        })
        .onConflictDoUpdate({
          target: [dailyYieldSnapshots.userId, dailyYieldSnapshots.snapshotDate],
          set: {
            usdcSupplied: posAfter.usdcSupplied.toFixed(6),
            usdcCurrentValue: finalValue.toFixed(6),
            apy: posAfter.apy.toFixed(4),
            brlQuote: finalBrl.toFixed(2),
            usdcBrlRate: rate.toFixed(6),
          },
        });

      results.push({
        userId: u.id,
        usdc: finalValue,
        brl: finalBrl,
        perfFeeUsdc,
        perfFeeBrl,
      });
    } catch (err) {
      results.push({
        userId: u.id,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  return NextResponse.json({ snapshotDate, processed: results.length, results });
}

export const POST = GET;
