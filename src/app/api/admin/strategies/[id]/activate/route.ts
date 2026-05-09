import { NextResponse } from 'next/server';
import { eq, isNotNull } from 'drizzle-orm';
import { logAdminAction, requireAdmin } from '@/lib/auth/require-role';
import { db } from '@/lib/db/client';
import { allocationStrategies } from '@/lib/db/schema';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { ctx, response } = await requireAdmin(req);
  if (!ctx) return response;

  const [strat] = await db
    .select()
    .from(allocationStrategies)
    .where(eq(allocationStrategies.id, params.id))
    .limit(1);
  if (!strat) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Desativa as outras
  await db
    .update(allocationStrategies)
    .set({ active: null })
    .where(isNotNull(allocationStrategies.active));

  // Ativa essa
  await db
    .update(allocationStrategies)
    .set({ active: new Date() })
    .where(eq(allocationStrategies.id, params.id));

  await logAdminAction({
    actorId: ctx.userId,
    action: 'activate_strategy',
    payload: { strategyId: params.id, name: strat.name },
  });

  return NextResponse.json({ ok: true });
}
