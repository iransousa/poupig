import { NextResponse } from 'next/server';
import { fourP } from '@/lib/four-p';
import { env } from '@/env';

/**
 * Teste rápido de cotação sem precisar de sessão Privy.
 * Útil pra validar que a API Key da 4P está funcionando.
 *
 * GET /api/dev/quote-test?amount=100&from=BRL&to=USDC
 *   header: Authorization: Bearer <CRON_SECRET>   (ou ?secret=... no query)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = req.headers.get('authorization');
  const secretFromQuery = url.searchParams.get('secret');
  if (env.CRON_SECRET) {
    const ok = auth === `Bearer ${env.CRON_SECRET}` || secretFromQuery === env.CRON_SECRET;
    if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const amount = url.searchParams.get('amount') ?? '100';
  const from = (url.searchParams.get('from') ?? 'BRL') as string;
  const to = (url.searchParams.get('to') ?? 'USDC') as string;

  try {
    const res = await fourP.priceConversion({ amount, from, to });
    return NextResponse.json({
      driver: env.FOUR_P_DRIVER,
      input: { amount, from, to },
      output: {
        symbol: res.info.data.symbol,
        amount: res.info.data.amount,
        price: res.info.data.quote.price,
        timestamp: res.info.data.quote.timestamp,
      },
      raw: res,
    });
  } catch (err) {
    return NextResponse.json(
      {
        driver: env.FOUR_P_DRIVER,
        error: err instanceof Error ? err.message : 'unknown',
      },
      { status: 502 },
    );
  }
}
