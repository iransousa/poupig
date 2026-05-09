import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { logAdminAction, requireAdmin } from '@/lib/auth/require-role';
import { db } from '@/lib/db/client';
import { allocationStrategies, allocationTargets } from '@/lib/db/schema';

export async function GET(req: Request) {
  const { ctx, response } = await requireAdmin(req);
  if (!ctx) return response;

  const strategies = await db
    .select()
    .from(allocationStrategies)
    .orderBy(desc(allocationStrategies.createdAt));

  const result = await Promise.all(
    strategies.map(async (s) => {
      const targets = await db
        .select()
        .from(allocationTargets)
        .where(eq(allocationTargets.strategyId, s.id));
      return {
        ...s,
        totalWeightBps: targets.reduce((acc, t) => acc + t.weightBps, 0),
        targets: targets.map((t) => ({ ...t })),
      };
    }),
  );

  return NextResponse.json({ items: result });
}

const targetSchema = z.object({
  kind: z.enum(['reserve', 'vault']),
  label: z.string().min(1),
  marketPubkey: z.string().min(32),
  targetPubkey: z.string().min(32),
  mintPubkey: z.string().min(32),
  symbol: z.string().default('USDC'),
  weightBps: z.number().int().min(1).max(10000),
});

const createSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  targets: z.array(targetSchema).min(1),
});

export async function POST(req: Request) {
  const { ctx, response } = await requireAdmin(req);
  if (!ctx) return response;

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const totalBps = parsed.data.targets.reduce((s, t) => s + t.weightBps, 0);
  if (totalBps !== 10000) {
    return NextResponse.json(
      { error: 'weights_must_sum_10000', total: totalBps },
      { status: 400 },
    );
  }

  const [strat] = await db
    .insert(allocationStrategies)
    .values({
      name: parsed.data.name,
      description: parsed.data.description,
      createdBy: ctx.userId,
    })
    .returning();

  await db.insert(allocationTargets).values(
    parsed.data.targets.map((t) => ({
      strategyId: strat.id,
      kind: t.kind,
      label: t.label,
      marketPubkey: t.marketPubkey,
      targetPubkey: t.targetPubkey,
      mintPubkey: t.mintPubkey,
      symbol: t.symbol,
      weightBps: t.weightBps,
    })),
  );

  await logAdminAction({
    actorId: ctx.userId,
    action: 'create_strategy',
    payload: { strategyId: strat.id, name: strat.name, targets: parsed.data.targets },
  });

  return NextResponse.json({ id: strat.id, ok: true }, { status: 201 });
}
