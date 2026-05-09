import { NextResponse } from 'next/server';
import { z } from 'zod';
import { desc } from 'drizzle-orm';
import { logAdminAction, requireAdmin, requireRole } from '@/lib/auth/require-role';
import { db } from '@/lib/db/client';
import { feeConfig } from '@/lib/db/schema';
import { loadFeeConfig } from '@/lib/fees/calc';

export async function GET(req: Request) {
  const { ctx, response } = await requireRole(req, ['admin', 'support']);
  if (!ctx) return response;
  const cfg = await loadFeeConfig();
  return NextResponse.json(cfg);
}

const schema = z.object({
  onrampFixedBrl: z.coerce.number().min(0),
  onrampPercentBps: z.coerce.number().int().min(0).max(10000),
  offrampFixedBrl: z.coerce.number().min(0),
  offrampPercentBps: z.coerce.number().int().min(0).max(10000),
  performancePercentBps: z.coerce.number().int().min(0).max(10000),
  minDepositBrl: z.coerce.number().min(0),
  minWithdrawBrl: z.coerce.number().min(0),
});

export async function POST(req: Request) {
  const { ctx, response } = await requireAdmin(req);
  if (!ctx) return response;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [prev] = await db.select().from(feeConfig).orderBy(desc(feeConfig.updatedAt)).limit(1);

  await db.insert(feeConfig).values({
    onrampFixedBrl: parsed.data.onrampFixedBrl.toFixed(2),
    onrampPercentBps: parsed.data.onrampPercentBps,
    offrampFixedBrl: parsed.data.offrampFixedBrl.toFixed(2),
    offrampPercentBps: parsed.data.offrampPercentBps,
    performancePercentBps: parsed.data.performancePercentBps,
    minDepositBrl: parsed.data.minDepositBrl.toFixed(2),
    minWithdrawBrl: parsed.data.minWithdrawBrl.toFixed(2),
    updatedBy: ctx.userId,
  });

  await logAdminAction({
    actorId: ctx.userId,
    action: 'update_fee_config',
    payload: { before: prev, after: parsed.data },
  });

  return NextResponse.json({ ok: true });
}
