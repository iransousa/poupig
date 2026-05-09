import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/session';
import { fourP } from '@/lib/four-p';

const schema = z.object({
  amount: z.coerce.number().positive(),
  from: z.enum(['BRL', 'USDC']).default('BRL'),
  to: z.enum(['BRL', 'USDC']).default('USDC'),
});

export async function POST(req: Request) {
  const { session, response } = await requireSession(req);
  if (!session) return response;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }
  if (parsed.data.from === parsed.data.to) {
    return NextResponse.json({ error: 'same_currency' }, { status: 400 });
  }

  const quote = await fourP.priceConversion({
    amount: parsed.data.amount.toString(),
    from: parsed.data.from,
    to: parsed.data.to,
  });

  return NextResponse.json({
    from: parsed.data.from,
    to: parsed.data.to,
    amountIn: parsed.data.amount,
    amountOut: Number(quote.info.data.amount),
    rate: Number(quote.info.data.quote.price),
    timestamp: quote.info.data.quote.timestamp,
  });
}
